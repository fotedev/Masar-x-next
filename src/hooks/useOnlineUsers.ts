import { useState, useEffect, useCallback } from 'react';
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
  const [subscription, setSubscription] = useState<RealtimeChannel | null>(null);

  // Track user presence
  const trackPresence = useCallback(async () => {
    if (!subscription) {
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
        .on('presence', { event: 'join' }, ({ key, newPresences }: { key: string; newPresences: unknown[] }) => {
          console.log('User joined:', key, newPresences);
          setOnlineCount(prev => prev + 1);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }: { key: string; leftPresences: unknown[] }) => {
          console.log('User left:', key, leftPresences);
          setOnlineCount(prev => Math.max(0, prev - 1));
        });

      // Subscribe first, then track presence
      await channel.subscribe();

      // Track current user only after subscription
      if (user) {
        await channel.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
        });
      }

      setSubscription(channel);
    }
  }, [subscription]);

  // Initialize presence tracking
  useEffect(() => {
    setLoading(true);
    trackPresence().finally(() => setLoading(false));

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe();
        setSubscription(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackPresence]);

  // Handle auth state changes
  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Re-track presence when user signs in - only if subscription exists and is subscribed
          if (subscription && subscription.state === 'joined') {
            await subscription.track({
              user_id: session.user.id,
              online_at: new Date().toISOString(),
            });
          } else {
            // If no valid subscription, re-initialize presence tracking
            await trackPresence();
          }
        } else if (event === 'SIGNED_OUT') {
          // Clean up presence when user signs out
          if (subscription) {
            subscription.unsubscribe();
            setSubscription(null);
            setOnlineCount(0);
            setOnlineUsers([]);
          }
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, [trackPresence]);

  return {
    onlineUsers,
    onlineCount,
    loading,
    isOnline: onlineCount > 0
  };
}
