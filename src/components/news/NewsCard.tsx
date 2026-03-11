import React from "react";
import { Trash } from "lucide-react";
import { News } from "../../types/database";

interface NewsCardProps {
  item: News;
  isAdmin: boolean;
  onToggleStatus: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  t: any;
}

export function NewsCard({
  item,
  isAdmin,
  onToggleStatus,
  onDelete,
  t,
}: NewsCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
      <div className="flex flex-col gap-2 md:flex-row md:justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {item.title}
            </h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                item.is_active
                  ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
                  : "bg-gray-100 dark:bg-gray-900/50 text-gray-800 dark:text-gray-300"
              }`}
            >
              {item.is_active ? t("active") : t("inactive")}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            {item.content.length > 200
              ? `${item.content.substring(0, 200)}...`
              : item.content}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>
              {t("type")}: {item.type}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 ml-0 sm:ml-4">
          <button
            onClick={() => onToggleStatus(item.id, !item.is_active)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              item.is_active
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {item.is_active ? t("deactivate") : t("activate")}
          </button>
          {isAdmin && (
            <button
              onClick={() => onDelete(item.id)}
              className="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-red-500 hover:bg-red-600 text-white"
            >
              <Trash className="w-4 h-4 inline-block mr-1" /> {t("delete")}
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {t("publishedAt")}:{" "}
        {item.created_at
          ? new Date(item.created_at).toLocaleDateString()
          : "---"}
      </div>
    </div>
  );
}
