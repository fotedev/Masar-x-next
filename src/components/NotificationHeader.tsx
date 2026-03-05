import { X } from "lucide-react";
import { NOTIFICATION_ACCESSIBILITY_KEYS } from "../constants/notifications";

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
    <div className="p-6 border-b border-gray-200/50 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center justify-between flex-row-reverse">
        <button
          onClick={onClose}
          className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl transition-all duration-300 text-gray-400 hover:text-gray-900 dark:hover:text-white group"
          title={NOTIFICATION_ACCESSIBILITY_KEYS.closeButton}
          aria-label={NOTIFICATION_ACCESSIBILITY_KEYS.closeButton}
        >
          <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
        </button>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && onMarkAllAsRead && (
            <button
              onClick={onMarkAllAsRead}
              disabled={isMarkingAll}
              className={`text-[13px] font-bold transition-all duration-300 rounded-xl px-4 py-2 flex items-center gap-2 ${
                isMarkingAll
                  ? "text-gray-400 cursor-not-allowed bg-gray-100 dark:bg-white/5"
                  : "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10 hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white dark:hover:text-white shadow-sm hover:shadow-blue-500/25 active:scale-95"
              }`}
              title="تحديد جميع الإشعارات كمقروءة"
              aria-label={`تحديد ${unreadCount} إشعار كمقروء`}
            >
              {isMarkingAll ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>جاري التحديث</span>
                </>
              ) : (
                "تحديد الكل كمقروء"
              )}
            </button>
          )}
        </div>

        <div className="flex flex-col">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            الإشعارات
            {unreadCount > 0 && (
              <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white shadow-lg shadow-blue-500/30">
                {unreadCount}
              </span>
            )}
          </h3>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">
            لديك {unreadCount} إشعارات غير مقروءة
          </p>
        </div>
      </div>
    </div>
  );
}
