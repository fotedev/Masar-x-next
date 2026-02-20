/**
 * Notification type definitions and configurations
 */
export const NOTIFICATION_TYPES = {
  ADMIN_SUBMISSION: 'admin_submission',
  CONTENT_PUBLISHED: 'content_published',
  SYSTEM: 'system',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

/**
 * Notification styling configurations
 */
export const NOTIFICATION_STYLES = {
  container: 'fixed top-24 left-1/2 -translate-x-1/2 md:absolute md:top-full md:left-0 md:translate-x-0 md:mt-4 w-96 sm:w-[28rem] max-w-[calc(100vw-1.5rem)] bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-200/50 dark:border-white/10 z-50 overflow-hidden transition-all duration-500 ease-out animate-in fade-in slide-in-from-top-4',
  header: 'p-6 border-b border-gray-200/50 dark:border-white/5 bg-white/50 dark:bg-white/[0.02]',
  list: 'max-h-[35rem] overflow-y-auto custom-scrollbar py-2',
  footer: 'p-4 border-t border-gray-200/50 dark:border-white/5 text-center bg-gray-50/50 dark:bg-white/[0.01]',
  emptyState: 'p-16 text-center flex flex-col items-center justify-center gap-6',
  item: {
    base: 'p-5 mx-3 my-1 rounded-2xl hover:bg-gray-100/80 dark:hover:bg-white/[0.03] cursor-pointer transition-all duration-300 border border-transparent hover:border-gray-200/50 dark:hover:border-white/5 group relative overflow-hidden',
    unread: 'bg-blue-50/40 dark:bg-blue-500/5 border-blue-100/30 dark:border-blue-400/10',
  },
  badge: 'absolute -top-1 -right-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg shadow-blue-500/30 border-2 border-white dark:border-gray-900 animate-in zoom-in duration-500',
} as const;

/**
 * ARIA labels and accessibility text
 */
export const NOTIFICATION_ACCESSIBILITY = {
  dropdown: 'قائمة الإشعارات',
  bellButton: 'الإشعارات',
  closeButton: 'إغلاق قائمة الإشعارات',
  markAllRead: 'تحديد الكل كمقروء',
  deleteNotification: 'حذف الإشعار',
  loading: 'جاري التحميل...',
  empty: 'لا توجد إشعارات',
  unreadBadge: 'عدد الإشعارات غير المقروءة',
} as const;

/**
 * Maximum notifications to display
 */
export const NOTIFICATION_LIMITS = {
  DISPLAY_MAX: 50,
  UNREAD_BADGE_MAX: 9,
} as const;
