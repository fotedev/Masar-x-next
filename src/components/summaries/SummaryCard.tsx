import { Star, Edit } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

interface SummaryCardProps {
  summary: any;
  user: any;
  isAdmin: boolean;
  onEdit?: (summary: any) => void;
  onUpdateStatus: (id: string, status: "approved" | "rejected") => void;
  onDelete: (id: string) => void;
}

export function SummaryCard({
  summary,
  user,
  isAdmin,
  onEdit,
  onUpdateStatus,
  onDelete,
}: SummaryCardProps) {
  const t = useTranslations("summaries.card");
  const locale = useLocale();
  const canEdit = user && (isAdmin || summary.user_id === user.id);
  const canDelete = user && (isAdmin || summary.user_id === user.id);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 transition-colors">
      <div className="flex flex-col gap-2 md:flex-row md:justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("titlePrefix")}: {summary.title}
            </h3>
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(summary)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded"
                title={t("edit")}
              >
                <Edit size={16} />
              </button>
            )}
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                summary.status === "pending"
                  ? "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300"
                  : summary.status === "approved"
                    ? "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300"
                    : "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300"
              }`}
            >
              {summary.status === "pending"
                ? t("statusPending")
                : summary.status === "approved"
                  ? t("statusApproved")
                  : t("statusRejected")}
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-3">
            {summary.content.length > 200
              ? `${summary.content.substring(0, 200)}...`
              : summary.content}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>
              {t("by")}: {summary.contributor_name || t("anonymous")}
            </span>
            <span>
              {t("subject")}: {summary.subject}
            </span>
            {(summary.avg_rating ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-brand-orange">
                <Star className="w-3 h-3 fill-brand-orange" />
                {summary.avg_rating} ({summary.reviews_count})
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 ml-0 sm:ml-4">
          {isAdmin && (
            <>
              <button
                onClick={() => onUpdateStatus(summary.id, "approved")}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
              >
                {t("approve")}
              </button>
              <button
                onClick={() => onUpdateStatus(summary.id, "rejected")}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
              >
                {t("reject")}
              </button>
            </>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(summary.id)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
            >
              {t("delete")}
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {t("sentAt")}:{" "}
        {new Date(summary.created_at).toLocaleDateString(
          locale === "ar" ? "ar-SA" : "en-US",
        )}
      </div>
    </div>
  );
}
