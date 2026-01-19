import { Bell } from "lucide-react";
import type { Notification } from "../types/database";
import { NotificationItem } from "./NotificationItem";
import {
  NOTIFICATION_STYLES,
  NOTIFICATION_ACCESSIBILITY,
} from "../constants/notifications";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onNotificationClick: (notification: Notification) => void;
  onNotificationDelete: (notificationId: string) => void;
}

function LoadingState() {
  return (
    <div className={NOTIFICATION_STYLES.emptyState}>
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
      <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mt-2">
        {NOTIFICATION_ACCESSIBILITY.loading}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className={NOTIFICATION_STYLES.emptyState}>
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
        <Bell className="w-16 h-16 text-gray-300 dark:text-gray-600 relative z-10 animate-bounce duration-[3000ms]" />
      </div>
      <div className="space-y-2 relative z-10">
        <p className="text-xl font-bold text-gray-900 dark:text-white">
          {NOTIFICATION_ACCESSIBILITY.empty}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] mx-auto">
          لا توجد تنبيهات جديدة في الوقت الحالي. سنخبرك فور وصول شيء جديد!
        </p>
      </div>
    </div>
  );
}

export function NotificationList({
  notifications,
  loading,
  onNotificationClick,
  onNotificationDelete,
}: NotificationListProps) {
  if (loading) {
    return <LoadingState />;
  }

  if (notifications.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      className={NOTIFICATION_STYLES.list}
      role="list"
      aria-label="قائمة الإشعارات"
    >
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {notifications.map((notification) => (
          <div key={notification.id} role="listitem">
            <NotificationItem
              notification={notification}
              onClick={onNotificationClick}
              onDelete={onNotificationDelete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
