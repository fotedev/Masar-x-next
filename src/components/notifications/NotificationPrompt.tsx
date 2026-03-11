import { Bell } from "lucide-react";
import { useNotifications } from "./NotificationProvider";

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
