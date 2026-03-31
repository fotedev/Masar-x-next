import {
  useState,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { getLogoPath } from "../DynamicLogo";

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

      const hasDismissed = localStorage.getItem(
        "notification-prompt-dismissed",
      );
      if (Notification.permission === "default" && !hasDismissed) {
        setShowPrompt(true);
      }

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
      icon: getLogoPath(typeof window !== "undefined" ? document.documentElement.lang || "ar" : "ar"),
      badge: getLogoPath(typeof window !== "undefined" ? document.documentElement.lang || "ar" : "ar"),
      tag: "masarx-notification",
      requireInteraction: false,
      ...options,
    };

    if (document.visibilityState === "visible") {
      new Notification(title, defaultOptions);
    } else {
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
