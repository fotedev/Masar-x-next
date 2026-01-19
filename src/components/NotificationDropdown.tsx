import React, { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationHeader } from "./NotificationHeader";
import { NotificationList } from "./NotificationList";
import {
  NOTIFICATION_STYLES,
  NOTIFICATION_ACCESSIBILITY,
  NOTIFICATION_LIMITS,
} from "../constants/notifications";
import type { Notification } from "../types/database";

export const NotificationDropdown = React.memo(function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // إغلاق القائمة عند الضغط على Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    // يمكن إضافة navigation هنا إذا كان الإشعار يحتوي على رابط
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      await markAllAsRead();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleNotificationDelete = async (notificationId: string) => {
    await deleteNotification(notificationId);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        title={NOTIFICATION_ACCESSIBILITY.bellButton}
        aria-label={`${NOTIFICATION_ACCESSIBILITY.bellButton}${
          unreadCount > 0 ? ` (${unreadCount} جديد)` : ""
        }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span
            className={NOTIFICATION_STYLES.badge}
            aria-label={`${unreadCount} ${NOTIFICATION_ACCESSIBILITY.unreadBadge}`}
          >
            {unreadCount > NOTIFICATION_LIMITS.UNREAD_BADGE_MAX
              ? `${NOTIFICATION_LIMITS.UNREAD_BADGE_MAX}+`
              : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={NOTIFICATION_STYLES.container}
          role="listbox"
          aria-label={NOTIFICATION_ACCESSIBILITY.dropdown}
        >
          <NotificationHeader
            unreadCount={unreadCount}
            onClose={() => setIsOpen(false)}
            onMarkAllAsRead={handleMarkAllAsRead}
            isMarkingAll={isMarkingAll}
          />

          <NotificationList
            notifications={notifications}
            loading={loading}
            onNotificationClick={handleNotificationClick}
            onNotificationDelete={handleNotificationDelete}
          />

          {notifications.length > 0 && (
            <div className={NOTIFICATION_STYLES.footer}>
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2 text-base font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 rounded"
              >
                إغلاق
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
