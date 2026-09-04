import { Trash2 } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import type { Notification } from "../types/database";
import {
  formatTimeAgo,
  getNotificationIcon,
  shouldHighlightNotification,
} from "../utils/notificationUtils";
import { NOTIFICATION_STYLES } from "../constants/notifications";

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
  const tNotifications = useTranslations("notifications");

  const handleDelete = async (e: MouseEvent<HTMLButtonElement>) => {
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
      } active:scale-[0.99]`}
      onClick={handleClick}
      aria-label={`${notification.title}: ${notification.message}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-[colors,transform] duration-300 group-hover:scale-110 ${
            isHighlighted
              ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
              : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400"
          }`}
          aria-hidden="true"
        >
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4
                  className={`text-[15px] font-bold truncate tracking-tight transition-colors duration-300 ${
                    isHighlighted
                      ? "text-blue-900 dark:text-blue-100"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {notification.title}
                </h4>
                {isHighlighted && (
                  <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                )}
              </div>
              <p
                className={`text-[14px] mt-1 line-clamp-2 leading-relaxed transition-colors duration-300 ${
                  isHighlighted
                    ? "text-blue-700/80 dark:text-blue-300/70"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {notification.message}
              </p>
              <div className="flex items-center gap-3 mt-2.5">
                <time
                  className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1"
                  dateTime={notification.created_at || undefined}
                >
                  <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                  {notification.created_at
                    ? formatTimeAgo(notification.created_at)
                    : tNotifications("unknownTime")}
                </time>
              </div>
            </div>

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-300 rounded-xl opacity-0 group-hover:opacity-100 focus-visible:opacity-100 translate-x-2 group-hover:translate-x-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
              title={tNotifications("deleteNotification")}
              aria-label={tNotifications("deleteNotificationAria", {
                title: notification.title,
              })}
              type="button"
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4.5 h-4.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
