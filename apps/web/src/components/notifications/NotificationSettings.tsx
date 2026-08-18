import { useState, useEffect } from "react";
import { useNotifications } from "./NotificationProvider";
import { NotificationToggle } from "./NotificationToggle";

export function NotificationSettings() {
  const { permission, requestPermission, isSupported } = useNotifications();
  const [settings, setSettings] = useState({
    newSummaries: true,
    newNews: true,
    appeals: false,
    systemUpdates: false,
  });

  useEffect(() => {
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
