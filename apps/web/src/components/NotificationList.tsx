import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Notification } from "../types/database";
import { NotificationItem } from "./NotificationItem";
import { NOTIFICATION_STYLES } from "../constants/notifications";

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onNotificationClick: (notification: Notification) => void;
  onNotificationDelete: (notificationId: string) => void;
}

function LoadingState(props: { tNotifications: (key: string) => string }) {
  const { tNotifications } = props;

  return (
    <div className={NOTIFICATION_STYLES.emptyState}>
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 bg-blue-500/15 blur-2xl rounded-full animate-pulse" />
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-blue-600/10 rounded-full" />
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
      <div className="space-y-1 relative z-10">
        <p className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
          {tNotifications("loading")}
        </p>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium animate-pulse">
          {tNotifications("loadingDescription")}
        </p>
      </div>
    </div>
  );
}

function EmptyState(props: { tNotifications: (key: string) => string }) {
  const { tNotifications } = props;

  return (
    <div className={NOTIFICATION_STYLES.emptyState}>
      <div className="relative group">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full group-hover:bg-blue-500/30 transition-colors duration-500" />
        <div className="relative z-10 w-24 h-24 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-white/5 dark:to-white/[0.02] rounded-3xl flex items-center justify-center shadow-xl border border-white dark:border-white/5 transform group-hover:scale-110 transition-transform duration-500">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 animate-wiggle" />
        </div>
      </div>
      <div className="space-y-3 relative z-10">
        <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
          {tNotifications("empty")}
        </p>
        <p className="text-[14px] text-gray-500 dark:text-gray-400 max-w-[240px] mx-auto leading-relaxed font-medium">
          {tNotifications("emptyDescription")}
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
  const tNotifications = useTranslations("notifications");

  if (loading) {
    return <LoadingState tNotifications={tNotifications} />;
  }

  if (notifications.length === 0) {
    return <EmptyState tNotifications={tNotifications} />;
  }

  return (
    <div
      className={NOTIFICATION_STYLES.list}
      role="list"
      aria-label={tNotifications("listAriaLabel")}
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
