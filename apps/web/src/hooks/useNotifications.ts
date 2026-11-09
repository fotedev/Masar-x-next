import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import type { Notification, NotificationInsert } from "../types/database";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";
import { logger } from "../lib/logger";
import { useAuth } from "../contexts/AuthContext";

// Keep track of inflight requests per user to deduplicate simultaneous calls
const inflightRequests = new Map<string, Promise<Notification[]>>();

export function useNotifications() {
  // Spec 034 Track C (audit AUTH-1): the user comes from context — the
  // server already resolved it (initialUser) — instead of four
  // supabase.auth.getUser() network roundtrips per mount.
  const { user: authUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const realtimeResubscribeTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const realtimeSetupPromiseRef = useRef<Promise<
    ReturnType<typeof supabase.channel> | undefined
  > | null>(null);

  // جلب الإشعارات مع caching
  const fetchNotifications = useCallback(async (skipCache = false) => {
    let userId: string | null = null;
    try {
      if (!authUser) return;
      userId = authUser.id;

      const cacheKey = cacheKeys.notifications(userId);

      // Check cache first (unless skipping)
      if (!skipCache) {
        const cached = queryCache.get<Notification[]>(cacheKey);
        if (cached && Array.isArray(cached)) {
          setNotifications(cached);
          setUnreadCount(cached.filter((n: Notification) => !n.read).length);
          setLoading(false);
          return;
        }
      }

      // If there's an inflight request for this user, wait for it
      if (inflightRequests.has(userId)) {
        const data = await inflightRequests.get(userId)!;
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.read).length);
        setLoading(false);
        return;
      }

      // Start a new request
      const request = (async () => {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        return data || [];
      })();

      inflightRequests.set(userId, request);
      const notificationData = await request;

      setNotifications(notificationData);
      setUnreadCount(
        notificationData.filter((n: Notification) => !n.read).length,
      );

      // Cache the result
      queryCache.set(cacheKey, notificationData, cacheTTL.notifications);
    } catch (err) {
      logger.error("fetchNotifications failed:", err);
    } finally {
      // Clear inflight request when done
      if (userId) inflightRequests.delete(userId);
      setLoading(false);
    }
  }, [authUser]);

  // تحديث حالة القراءة
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      logger.error("markAsRead failed:", err);
    }
  };

  // تحديث جميع الإشعارات كمقروءة
  const markAllAsRead = async () => {
    try {
      if (!authUser) return;
      const userId = authUser.id;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      logger.error("markAllAsRead failed:", err);
    }
  };

  // حذف إشعار
  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      const deletedNotification = notifications.find(
        (n) => n.id === notificationId,
      );
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      logger.error("deleteNotification failed:", err);
    }
  };

  // إنشاء إشعار جديد
  const createNotification = useCallback(
    async (notification: NotificationInsert) => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .insert(notification)
          .select()
          .single();

        if (error) throw error;

        // إذا كان الإشعار للمستخدم الحالي، أضفه للقائمة
        if (authUser && data.user_id === authUser.id) {
          setNotifications((prev) => [data, ...prev]);
          if (!data.read) {
            setUnreadCount((prev) => prev + 1);
          }
        }

        return data;
      } catch (error) {
        throw error;
      }
    },
    [authUser],
  );

  // إرسال إشعار لمستخدم محدد
  const notifyUser = useCallback(
    async (
      userId: string,
      title: string,
      message: string,
      type: NotificationInsert["type"],
      relatedId?: string,
      relatedType?: NotificationInsert["related_type"],
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
      } catch {
        // ignore
      }
    },
    [createNotification],
  );

  // إرسال إشعار للمدراء
  const notifyAdmins = useCallback(
    async (
      title: string,
      message: string,
      type: "admin_submission" | "content_published" | "system",
      relatedId?: string,
      relatedType?: "summary" | "news" | "appeal",
    ) => {
      try {
        // Fan-out runs server-side via a security-definer RPC (migration 011):
        // the old client-side flow read the admins table in the browser and
        // inserted rows for arbitrary user_ids. The RPC only delivers when
        // the caller filed an appeal against the content or is an admin.
        const { error } = await supabase.rpc("notify_admins_of_content", {
          p_type: type,
          p_related_type: relatedType ?? "",
          p_related_id: relatedId ?? null,
          p_title: title,
          p_message: message,
        });
        if (error) throw error;
      } catch (err) {
        logger.error("notifyAdmins failed:", err);
      }
    },
    [],
  );

  const notifyAllUsers = async (
    title: string,
    message: string,
    type: "admin_submission" | "content_published" | "system",
    relatedId?: string,
    relatedType?: "summary" | "news" | "appeal",
  ) => {
    try {
      // مؤقتاً: إرسال إشعار للمدراء فقط (حتى نضيف جدول المستخدمين)
      await notifyAdmins(title, message, type, relatedId, relatedType);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription for notifications
  useEffect(() => {
    const setupRealtime = async (): Promise<
      ReturnType<typeof supabase.channel> | undefined
    > => {
      if (realtimeChannelRef.current) return realtimeChannelRef.current;
      if (realtimeSetupPromiseRef.current)
        return realtimeSetupPromiseRef.current;

      const promise = (async () => {
        try {
          // Spec 034 Track C: context user instead of a getUser() roundtrip.
          if (!authUser) return;

          if (realtimeChannelRef.current) {
            return realtimeChannelRef.current;
          }

          const channel = supabase.channel(`notifications:${authUser.id}`).on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${authUser.id}`,
            },
            (payload: RealtimePostgresInsertPayload<Notification>) => {
              const newNotif = payload.new as Notification;
              setNotifications((prev) => [newNotif, ...prev]);
              if (!newNotif.read) {
                setUnreadCount((prev) => prev + 1);
              }
              // Invalidate the cache key so the next manual fetch gets fresh data
              queryCache.invalidate(cacheKeys.notifications(authUser.id));
            },
          );

          realtimeChannelRef.current = channel;
          channel.subscribe();

          return channel;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (
            message.includes("Navigator LockManager") &&
            message.includes("timed out")
          ) {
            if (!realtimeResubscribeTimeoutRef.current) {
              realtimeResubscribeTimeoutRef.current = setTimeout(() => {
                realtimeResubscribeTimeoutRef.current = null;
                void setupRealtime();
              }, 1500);
            }
            return;
          }
          return;
        } finally {
          realtimeSetupPromiseRef.current = null;
        }
      })();

      realtimeSetupPromiseRef.current = promise;
      return promise;
    };

    const channelPromise = setupRealtime();

    return () => {
      if (realtimeResubscribeTimeoutRef.current) {
        clearTimeout(realtimeResubscribeTimeoutRef.current);
        realtimeResubscribeTimeoutRef.current = null;
      }
      channelPromise.then((channel) => {
        if (!channel) return;
        if (realtimeChannelRef.current === channel) {
          realtimeChannelRef.current = null;
        }
        channel.unsubscribe().catch(() => {
          // ignore
        });
      });
    };
  }, [authUser, fetchNotifications]);

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
    notifyUser,
  };
}
