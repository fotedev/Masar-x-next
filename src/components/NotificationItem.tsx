import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { Notification } from "../types/database";
import {
  formatTimeAgo,
  getNotificationIcon,
  shouldHighlightNotification,
} from "../utils/notificationUtils";
import {
  NOTIFICATION_STYLES,
  NOTIFICATION_ACCESSIBILITY,
} from "../constants/notifications";

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
  onDelete: (notificationId: string) => void;
}

export function NotificationItem({
  notification,
  onClick,
  onDelete,
}: NotificationItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isHighlighted = shouldHighlightNotification(notification);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await onDelete(notification.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClick = () => {
    onClick(notification);
  };

  return (
    <div
      className={`${NOTIFICATION_STYLES.item.base} ${
        isHighlighted ? NOTIFICATION_STYLES.item.unread : ""
      } active:scale-[0.98]`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${notification.title}: ${notification.message}`}
    >
      <div className="flex items-start gap-4 rtl:gap-4">
        <div 
          className="w-12 h-12 flex-shrink-0 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300" 
          aria-hidden="true"
        >
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-bold text-gray-900 dark:text-white truncate tracking-tight">
                {notification.title}
              </h4>
              <p className="text-[14px] text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                {notification.message}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <time
                  className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                  dateTime={notification.created_at || undefined}
                >
                  {notification.created_at ? formatTimeAgo(notification.created_at) : 'غير معروف'}
                </time>
                {isHighlighted && (
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={`p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 rounded-xl opacity-0 group-hover:opacity-100 focus:opacity-100 ${
                  isDeleting ? "opacity-100 cursor-not-allowed" : ""
                }`}
                title={NOTIFICATION_ACCESSIBILITY.deleteNotification}
                aria-label={`${NOTIFICATION_ACCESSIBILITY.deleteNotification}: ${notification.title}`}
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
