
import { Check, X, Trash } from "lucide-react";
import { Appeal } from "../../types/database";

import { useTranslations } from "next-intl";

interface AppealCardProps {
  appeal: Appeal;
  isAdmin: boolean;
  onAccept: (id: string, userId: string, contentTitle: string) => void;
  onReject: (id: string, userId: string, contentTitle: string) => void;
  onDelete: (id: string) => void;
}

export function AppealCard({
  appeal,
  isAdmin,
  onAccept,
  onReject,
  onDelete,
}: AppealCardProps) {
  const t = useTranslations("appeals.card");
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 transition-colors">
      <div className="flex flex-col gap-2 md:flex-row md:justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("on")}:{" "}
              {appeal.content_type === "summary" ? t("summary") : t("news")}
              {appeal.content_title && ` - "${appeal.content_title}"`}
            </h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                appeal.status === "pending"
                  ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300"
                  : appeal.status === "accepted"
                    ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
                    : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300"
              }`}
            >
              {appeal.status === "pending"
                ? t("statusPending")
                : appeal.status === "accepted"
                  ? t("statusAccepted")
                  : t("statusRejected")}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            {appeal.reason}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>
              {t("by")}: {appeal.created_by || t("anonymous")}
            </span>
            <span>
              {t("contentId")}: {appeal.content_id}
            </span>
          </div>
          {appeal.reviewed_by && (
            <span className="text-sm text-gray-500 dark:text-gray-400 mt-2 block">
              {t("reviewedBy")}: {appeal.reviewed_by}
            </span>
          )}
        </div>
        {isAdmin && appeal.status === "pending" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 ml-0 sm:ml-4">
            <button
              onClick={() =>
                onAccept(
                  appeal.id,
                  appeal.created_by || "",
                  appeal.content_title || "",
                )
              }
              className="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="w-4 h-4 inline-block mr-1" /> {t("accept")}
            </button>
            <button
              onClick={() =>
                onReject(
                  appeal.id,
                  appeal.created_by || "",
                  appeal.content_title || "",
                )
              }
              className="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-red-600 hover:bg-red-700 text-white"
            >
              <X className="w-4 h-4 inline-block mr-1" /> {t("reject")}
            </button>
          </div>
        )}
        {isAdmin && appeal.status !== "pending" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 ml-0 sm:ml-4">
            <button
              onClick={() => onDelete(appeal.id)}
              className="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-gray-500 hover:bg-gray-600 text-white"
            >
              <Trash className="w-4 h-4 inline-block mr-1" /> {t("delete")}
            </button>
          </div>
        )}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {t("submittedAt")}:{" "}
        {appeal.created_at
          ? new Date(appeal.created_at).toLocaleDateString()
          : t("unknown")}
      </div>
    </div>
  );
}
