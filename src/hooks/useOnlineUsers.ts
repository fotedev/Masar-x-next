import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel, AuthChangeEvent, Session } from '@supabase/supabase-js';

interface OnlineUser {
  id: string;
  email: string;
  last_seen: string;
  is_online: boolean;
}

export function useOnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // Track user presence
  const trackPresence = useCallback(async () => {
    if (!subscriptionRef.current) {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'anonymous';

      const channel = supabase.channel('online-users', {
        config: {
          presence: {
            key: userId
          }
        }
      });

      // Listen for presence events
      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const onlineUserIds = Object.keys(presenceState);

          // Update online count
          setOnlineCount(onlineUserIds.length);

          // Update online users list (simplified - in real app you'd fetch user details)
          const onlineUsersList = onlineUserIds.map(id => ({
            id,
            email: 'user@example.com', // This would come from user metadata
            last_seen: new Date().toISOString(),
            is_online: true
          }));

          setOnlineUsers(onlineUsersList);
        })
        .on('presence', { event: 'join' }, () => {
          setOnlineCount(prev => prev + 1);
        })
        .on('presence', { event: 'leave' }, () => {
          setOnlineCount(prev => Math.max(0, prev - 1));
        });

      // Subscribe first, then track presence
      channel.subscribe(async (status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | string) => {
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        } else if (status === 'CLOSED') {
          setTimeout(() => channel.subscribe(), 5000);
        }
      });

      subscriptionRef.current = channel;
    }
  }, []);

  // Initialize presence tracking
  useEffect(() => {
    setLoading(true);
    trackPresence().finally(() => setLoading(false));

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [trackPresence]);

  // Handle auth state changes
  useEffect(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;
    
    const initAuthListener = async () => {
      const { data } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, session: Session | null) => {
          if (event === 'SIGNED_IN' && session?.user) {
            // Re-track presence when user signs in - only if subscription exists and is subscribed
            if (subscriptionRef.current && subscriptionRef.current.state === 'joined') {
              await subscriptionRef.current.track({
                user_id: session.user.id,
                online_at: new Date().toISOString(),
              });
            } else {
              // If no valid subscription, re-initialize presence tracking
              await trackPresence();
            }
          } else if (event === 'SIGNED_OUT') {
            // Clean up presence when user signs out
            if (subscriptionRef.current) {
              subscriptionRef.current.unsubscribe();
              subscriptionRef.current = null;
              setOnlineCount(0);
              setOnlineUsers([]);
            }
          }
        }
      );
      authSubscription = data.subscription;
    };

    initAuthListener();

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [trackPresence]);

  return {
    onlineUsers,
    onlineCount,
    loading,
    isOnline: onlineCount > 0
  };
}
