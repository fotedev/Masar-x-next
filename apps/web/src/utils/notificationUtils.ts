import type { Notification } from '../types/database';

/**
 * Format time ago for notification timestamps
 */
export function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'الآن';
  if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `منذ ${diffInDays} يوم`;

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
