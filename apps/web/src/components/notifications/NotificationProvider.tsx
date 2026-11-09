import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { getLogoPath } from "../DynamicLogo";
import { registerServiceWorker } from "@/lib/sw-register";
import { useTranslations } from "next-intl";

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

export function useBrowserNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useBrowserNotifications must be used within a NotificationProvider",
    );
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const t = useTranslations("notifications");
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
        // Defer prompt by 20 seconds to avoid interrupting first impression
        const timeoutId = setTimeout(() => setShowPrompt(true), 20000);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [isSupported]);

  // Register the Service Worker once on mount. Centralized here so
  // every user gets the PWA cache, not just users who granted
  // notification permission (the previous per-effect registration
  // was gated on `permission === "granted"`).
  useEffect(() => {
    registerServiceWorker();
  }, []);

  const requestPermission =
    useCallback(async (): Promise<NotificationPermission> => {
      if (!isSupported) return "denied";

      try {
        const result = await Notification.requestPermission();
        setPermission(result);
        setShowPrompt(false);

        // Service Worker registration is handled by the dedicated mount
        // effect above; no need to re-register on every permission grant.

        return result;
      } catch {
        return "denied";
      }
    }, [isSupported]);

  const sendNotification = useCallback(
    (title: string, options: NotificationOptions = {}) => {
      if (!isSupported || permission !== "granted") return;

      const defaultOptions: NotificationOptions = {
        body: t("defaultBody"),
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
    },
    [isSupported, permission, t],
  );

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem("notification-prompt-dismissed", "true");
  }, []);

  const value: NotificationContextType = useMemo(
    () => ({
      permission,
      requestPermission,
      sendNotification,
      showNotificationPrompt: showPrompt,
      dismissPrompt,
      isSupported,
    }),
    [permission, requestPermission, sendNotification, showPrompt, dismissPrompt, isSupported],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
