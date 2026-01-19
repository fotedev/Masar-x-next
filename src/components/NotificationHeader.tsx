import { X } from "lucide-react";
import { NOTIFICATION_ACCESSIBILITY } from "../constants/notifications";

interface NotificationHeaderProps {
  unreadCount: number;
  onClose: () => void;
  onMarkAllAsRead?: () => void;
  isMarkingAll?: boolean;
}

export function NotificationHeader({
  unreadCount,
  onClose,
  onMarkAllAsRead,
  isMarkingAll = false,
}: NotificationHeaderProps) {
  return (
    <div className="p-5 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
      <div className="flex items-center justify-between flex-row-reverse">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          title={NOTIFICATION_ACCESSIBILITY.closeButton}
          aria-label={NOTIFICATION_ACCESSIBILITY.closeButton}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 rtl:space-x-reverse">
          {unreadCount > 0 && onMarkAllAsRead && (
            <button
              onClick={onMarkAllAsRead}
              disabled={isMarkingAll}
              className={`text-xs font-bold tracking-wide uppercase transition-all duration-200 rounded-lg px-3 py-1.5 ${
                isMarkingAll
                  ? "text-gray-400 cursor-not-allowed bg-gray-100 dark:bg-gray-800"
                  : "text-blue-600 hover:text-white dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-600 dark:hover:bg-blue-500 shadow-sm hover:shadow-blue-500/25"
              }`}
              title="تحديد جميع الإشعارات كمقروءة"
              aria-label={`تحديد ${unreadCount} إشعار كمقروء`}
            >
              {isMarkingAll ? (
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  جاري التحديث
                </span>
              ) : (
                "تحديد الكل كمقروء"
              )}
            </button>
          )}
        </div>

        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex-shrink-0 tracking-tight">
          الإشعارات
          {unreadCount > 0 && (
            <span className="mr-2 text-sm font-medium px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full">
              {unreadCount}
            </span>
          )}
        </h3>
      </div>
    </div>
  );
}
