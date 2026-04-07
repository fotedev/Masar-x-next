import { useState, type MouseEvent } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "./NotificationProvider";

export function NotificationToggle() {
  const { permission, requestPermission, sendNotification } =
    useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isLoading) {
      return; // Prevent multiple clicks
    }

    setIsLoading(true);
    try {
      if (permission === "default" || permission === "denied") {
        if (!("Notification" in window)) {
          toast.error("متصفحك لا يدعم الإشعارات");
          return;
        }

        const result = await requestPermission();

        if (result === "granted") {
          if (
            typeof window !== "undefined" &&
            "serviceWorker" in navigator &&
            (!process.env.NODE_ENV || process.env.NODE_ENV !== "development")
          ) {
            try {
              await navigator.serviceWorker.register("/sw.js");
            } catch {
              // Registration failed
            }
          }
        } else if (result === "denied") {
          const message = `تم رفض إذن الإشعارات.

لإعادة تفعيل الإشعارات:
• Chrome: اضغط على قفل الموقع في شريط العنوان ← إعدادات الموقع ← الإشعارات
• Firefox: اضغط على قفل الموقع في شريط العنوان ← الإشعارات
• Safari: Safari ← التفضيلات ← الخصوصية ← إدارة بيانات الموقع

أو يمكنك النقر على أيقونة الجرس مرة أخرى للمحاولة.`;

          toast.error("تم رفض إذن الإشعارات", {
            description: message,
            duration: 8000,
          });
        }
      } else if (permission === "granted") {
        sendNotification("اختبار الإشعارات", {
          body: "هذا إشعار تجريبي من Masar X",
          tag: "test-notification",
        });
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    if (isLoading) return "جاري طلب الإذن...";
    if (permission === "granted") return "الإشعارات مفعلة - اضغط للاختبار";
    if (permission === "denied")
      return "الإشعارات محظورة - اضغط للمحاولة مرة أخرى";
    return "اضغط لتفعيل الإشعارات";
  };

  const getIconColor = () => {
    if (permission === "granted") return "text-green-600 dark:text-green-400";
    if (permission === "denied") return "text-red-500 dark:text-red-400";
    return "text-gray-400";
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`p-2 rounded-md transition-[background-color,color,box-shadow] duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
        permission === "granted"
          ? "hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400"
          : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      }`}
      title={getTitle()}
      aria-label={getTitle()}
      type="button"
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : permission === "granted" ? (
        <Bell className={`w-5 h-5 ${getIconColor()}`} />
      ) : (
        <BellOff className={`w-5 h-5 ${getIconColor()}`} />
      )}
    </button>
  );
}
