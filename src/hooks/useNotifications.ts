import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Notification, NotificationInsert } from '../types/database';
import { queryCache, cacheKeys, cacheTTL } from '../lib/queryCache';

// Keep track of inflight requests per user to deduplicate simultaneous calls
const inflightRequests = new Map<string, Promise<Notification[]>>();

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // جلب الإشعارات مع caching
  const fetchNotifications = async (skipCache = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cacheKey = cacheKeys.notifications(user.id);

      // Check cache first (unless skipping)
      if (!skipCache) {
        const cached = queryCache.get<Notification[]>(cacheKey);
        if (cached) {
          setNotifications(cached);
          setUnreadCount(cached.filter((n: Notification) => !n.read).length);
          setLoading(false);
          return;
        }
      }

      // If there's an inflight request for this user, wait for it
      if (inflightRequests.has(user.id)) {
        const data = await inflightRequests.get(user.id)!;
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.read).length);
        setLoading(false);
        return;
      }

      // Start a new request
      const request = (async () => {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data || [];
      })();

      inflightRequests.set(user.id, request);
      const notificationData = await request;

      setNotifications(notificationData);
      setUnreadCount(notificationData.filter((n: Notification) => !n.read).length);

      // Cache the result
      queryCache.set(cacheKey, notificationData, cacheTTL.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      // Clear inflight request when done
      const { data: { user } } = await supabase.auth.getUser();
      if (user) inflightRequests.delete(user.id);
      setLoading(false);
    }
  };

  // تحديث حالة القراءة
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // تحديث جميع الإشعارات كمقروءة
  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // حذف إشعار
  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // إنشاء إشعار جديد
  const createNotification = useCallback(async (notification: NotificationInsert) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single();

      if (error) throw error;

      // إذا كان الإشعار للمستخدم الحالي، أضفه للقائمة
      const { data: { user } } = await supabase.auth.getUser();
      if (user && data.user_id === user.id) {
        setNotifications(prev => [data, ...prev]);
        if (!data.read) {
          setUnreadCount(prev => prev + 1);
        }
      }

      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }, []);

  // إرسال إشعار لمستخدم محدد
  const notifyUser = useCallback(async (
    userId: string,
    title: string,
    message: string,
    type: NotificationInsert['type'],
    relatedId?: string,
    relatedType?: NotificationInsert['related_type']
  ) => {
    try {
      const notification: NotificationInsert = {
        user_id: userId,
        title,
        message,
        type,
        related_id: relatedId,
        related_type: relatedType,
        read: false,
      };
      await createNotification(notification);
    } catch (error) {
      console.error('Error notifying user:', error);
    }
  }, [createNotification]);

  // إرسال إشعار للمدراء
  const notifyAdmins = useCallback(async (
    title: string,
    message: string,
    type: 'admin_submission' | 'content_published' | 'system',
    relatedId?: string,
    relatedType?: 'summary' | 'news' | 'appeal'
  ) => {
    try {
      // الحصول على جميع المدراء
      const { data: admins, error } = await supabase
        .from('admins')
        .select('user_id');

      if (error) throw error;

      if (!admins || admins.length === 0) {
        console.warn('No admins found to notify');
        return;
      }

      // إنشاء إشعارات لجميع المدراء
      const notifications = admins.map((admin: { user_id: string }) => ({
        user_id: admin.user_id,
        title,
        message,
        type,
        related_id: relatedId,
        related_type: relatedType,
        read: false
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) throw insertError;

      console.log(`Notifications sent to ${admins.length} admins`);
    } catch (error) {
      console.error('Error notifying admins:', error);
    }
  }, []);

  // إرسال إشعار لجميع المستخدمين (مؤقتاً: إرسال للمدراء فقط)
  const notifyAllUsers = useCallback(async (
    title: string,
    message: string,
    type: 'content_published' | 'system',
    relatedId?: string,
    relatedType?: 'summary' | 'news'
  ) => {
    try {
      // مؤقتاً: إرسال إشعار للمدراء فقط (حتى نضيف جدول المستخدمين)
      await notifyAdmins(title, message, type as any, relatedId, relatedType);
      console.log('Notification sent to admins (all users notification temporarily disabled)');
    } catch (error) {
      console.error('Error notifying all users:', error);
    }
  }, [notifyAdmins]);

  // الاشتراك في التحديثات التلقائية
  useEffect(() => {
    fetchNotifications();

    // الاشتراك في التحديثات التلقائية للإشعارات
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events: INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'notifications',
        },
        (payload: RealtimePostgresChangesPayload<Notification>) => {
          console.log('Notification change received:', payload);
          fetchNotifications(); // إعادة جلب الإشعارات
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification,
    notifyAdmins,
    notifyAllUsers,
    notifyUser
  };
}
