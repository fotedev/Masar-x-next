import type { Notification } from '../types/database';

/**
 * Format time ago for notification timestamps.
 *
 * Pass an i18n translator so the relative-time labels can be localized.
 * Server Components / non-React callers should resolve a translator via
 * `getTranslations('notifications')` from `next-intl/server` and pass it.
 */
export function formatTimeAgo(
  dateString: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return t('timeAgo.now');
  if (diffInMinutes < 60) {
    return t('timeAgo.minutesAgo', { count: diffInMinutes });
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return t('timeAgo.hoursAgo', { count: diffInHours });
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return t('timeAgo.daysAgo', { count: diffInDays });
  }

  return date.toLocaleDateString('ar-EG');
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: string): string {
  const icons = {
    admin_submission: '📝',
    content_published: '📰',
    system: '⚙️',
  } as const;

  return icons[type as keyof typeof icons] || '🔔';
}

/**
 * Get notification priority level for styling
 */
export function getNotificationPriority(notification: Notification): 'high' | 'normal' {
  return notification.type === 'system' ? 'high' : 'normal';
}

/**
 * Check if notification should have special styling
 */
export function shouldHighlightNotification(notification: Notification): boolean {
  return !notification.read || notification.type === 'system';
}
