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
  container: 'fixed top-24 left-1/2 -translate-x-1/2 md:absolute md:top-full md:left-0 md:translate-x-0 md:mt-2 w-96 sm:w-[28rem] max-w-[calc(100vw-1.5rem)] bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 z-50 overflow-hidden transition-all duration-300 ease-out',
  header: 'p-5 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-900/50',
  list: 'max-h-[32rem] overflow-y-auto custom-scrollbar',
  footer: 'p-4 border-t border-gray-200/50 dark:border-gray-700/50 text-center bg-gray-50/50 dark:bg-gray-800/50',
  emptyState: 'p-12 text-center flex flex-col items-center justify-center gap-4',
  item: {
    base: 'p-5 mx-2 my-1 rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/80 cursor-pointer transition-all duration-200 border border-transparent hover:border-gray-200/50 dark:hover:border-gray-700/50 group',
    unread: 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100/50 dark:border-blue-800/50',
  },
  badge: 'absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-pink-600 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-900 animate-in zoom-in duration-300',
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
