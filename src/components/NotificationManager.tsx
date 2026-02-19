"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { Bell, BellOff } from "lucide-react";

interface NotificationContextType {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  sendNotification: (title: string, options?: NotificationOptions) => void;
  showNotificationPrompt: boolean;
  dismissPrompt: () => void;
  isSupported: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "Notification" in window);
  }, []);

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);

      // إذا كان الإذن default ولم يتم رفضه من قبل، أظهر المطالبة
      const hasDismissed = localStorage.getItem(
        "notification-prompt-dismissed",
      );
      if (Notification.permission === "default" && !hasDismissed) {
        setShowPrompt(true);
      }

      // تسجيل Service Worker إذا لم يكن مسجل (فقط في الإنتاج لتجنب مشاكل HMR)
      if (
        ("serviceWorker" in navigator &&
          Notification.permission === "granted" &&
          !process.env.NODE_ENV) ||
        process.env.NODE_ENV !== "development"
      ) {
        navigator.serviceWorker.register("/sw.js").then(() => {
          // Service Worker registered
        });
      }
    }
  }, [isSupported]);

  const requestPermission = async (): Promise<NotificationPermission> => {
    if (!isSupported) return "denied";

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowPrompt(false);

      if (result === "granted") {
        // تسجيل Service Worker إذا لم يكن مسجل (فقط في الإنتاج)
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
      }

      return result;
    } catch {
      return "denied";
    }
  };

  const sendNotification = (
    title: string,
    options: NotificationOptions = {},
  ) => {
    if (!isSupported || permission !== "granted") return;

    const defaultOptions: NotificationOptions = {
      body: "إشعار جديد من Masar X",
      icon: "/logo.png",
      badge: "/logo.png",
      tag: "masarx-notification",
      requireInteraction: false,
      ...options,
    };

    // إذا كان التطبيق في المقدمة، استخدم الإشعارات العادية
    if (document.visibilityState === "visible") {
      new Notification(title, defaultOptions);
    } else {
      // إذا كان التطبيق في الخلفية، استخدم Service Worker
      navigator.serviceWorker.controller?.postMessage({
        type: "NOTIFICATION_REQUEST",
        payload: { title, ...defaultOptions },
      });
    }
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    localStorage.setItem("notification-prompt-dismissed", "true");
  };

  const value: NotificationContextType = {
    permission,
    requestPermission,
    sendNotification,
    showNotificationPrompt: showPrompt,
    dismissPrompt,
    isSupported,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// مكون لطلب إذن الإشعارات
export function NotificationPrompt() {
  const {
    showNotificationPrompt,
    requestPermission,
    dismissPrompt,
    isSupported,
  } = useNotifications();

  if (!showNotificationPrompt || !isSupported) return null;

  const handleAllow = async () => {
    await requestPermission();
  };

  const handleDeny = () => {
    dismissPrompt();
  };

  return (
    <div className="fixed bottom-20 left-3 right-3 sm:left-4 sm:right-4 z-40 md:left-auto md:right-4 md:w-96">
      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg shadow-lg p-3 sm:p-4">
        <div className="flex items-start space-x-3 rtl:space-x-reverse">
          <div className="bg-blue-100 dark:bg-blue-800 p-2 rounded-full">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              تفعيل الإشعارات
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              احصل على إشعارات عندما تكون هناك ملخصات أو أخبار جديدة
            </p>
          </div>
        </div>
        <div className="mt-3 flex space-x-2 rtl:space-x-reverse">
          <button
            onClick={handleAllow}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors"
          >
            تفعيل
          </button>
          <button
            onClick={handleDeny}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium py-2 px-4"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}

// مكون زر الإشعارات في الهيدر أو الإعدادات
export function NotificationToggle() {
  const { permission, requestPermission, sendNotification } =
    useNotifications();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isLoading) {
      return; // Prevent multiple clicks
    }

    setIsLoading(true);
    try {
      if (permission === "default" || permission === "denied") {
        // طلب الإذن مباشرة من المتصفح
        if (!("Notification" in window)) {
          alert("متصفحك لا يدعم الإشعارات");
          return;
        }

        const result = await requestPermission();

        if (result === "granted") {
          // تسجيل Service Worker إذا لم يكن مسجل (فقط في الإنتاج)
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
          // إظهار رسالة تفصيلية للمستخدم
          const message = `تم رفض إذن الإشعارات.

لإعادة تفعيل الإشعارات:
• Chrome: اضغط على قفل الموقع في شريط العنوان ← إعدادات الموقع ← الإشعارات
• Firefox: اضغط على قفل الموقع في شريط العنوان ← الإشعارات
• Safari: Safari ← التفضيلات ← الخصوصية ← إدارة بيانات الموقع

أو يمكنك النقر على أيقونة الجرس مرة أخرى للمحاولة.`;

          alert(message);
        }
      } else if (permission === "granted") {
        // اختبار الإشعارات
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
      className={`p-2 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
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

// مكون إعدادات الإشعارات
export function NotificationSettings() {
  const { permission, requestPermission, isSupported } = useNotifications();
  const [settings, setSettings] = useState({
    newSummaries: true,
    newNews: true,
    appeals: false,
    systemUpdates: false,
  });

  useEffect(() => {
    // تحميل الإعدادات من localStorage
    const savedSettings = localStorage.getItem("notification-settings");
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem("notification-settings", JSON.stringify(newSettings));
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          متصفحك لا يدعم الإشعارات
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            إعدادات الإشعارات
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            تحكم في الإشعارات التي تريد تلقيها
          </p>
        </div>
        <NotificationToggle />
      </div>

      {permission !== "granted" && (
        <button
          onClick={requestPermission}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
        >
          تفعيل الإشعارات
        </button>
      )}

      {permission === "granted" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="new-summaries-notification"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              ملخصات جديدة
            </label>
            <input
              id="new-summaries-notification"
              name="newSummariesNotification"
              type="checkbox"
              checked={settings.newSummaries}
              onChange={(e) => updateSetting("newSummaries", e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>

          <div className="flex items-center justify-between">
            <label
              htmlFor="new-news-notification"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              أخبار جديدة
            </label>
            <input
              id="new-news-notification"
              name="newNewsNotification"
              type="checkbox"
              checked={settings.newNews}
              onChange={(e) => updateSetting("newNews", e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>

          <div className="flex items-center justify-between">
            <label
              htmlFor="appeals-notification"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              الاستفسارات الجديدة
            </label>
            <input
              id="appeals-notification"
              name="appealsNotification"
              type="checkbox"
              checked={settings.appeals}
              onChange={(e) => updateSetting("appeals", e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>

          <div className="flex items-center justify-between">
            <label
              htmlFor="system-updates-notification"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              تحديثات النظام
            </label>
            <input
              id="system-updates-notification"
              name="systemUpdatesNotification"
              type="checkbox"
              checked={settings.systemUpdates}
              onChange={(e) => updateSetting("systemUpdates", e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              autoComplete="off"
            />
          </div>
        </div>
      )}
    </div>
  );
}
