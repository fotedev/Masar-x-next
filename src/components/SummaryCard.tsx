import React, { useEffect, useRef } from "react";
import { Download, Eye, Edit } from "lucide-react";
import { useAnalytics } from "../hooks/useAnalytics";

interface SummaryCardProps {
  id: string;
  title: string;
  description?: string;
  examInfo?: {
    date?: string;
    type?: string;
    subject?: string;
  };
  downloadUrl?: string;
  onDownload?: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
  className?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  id,
  title,
  description,
  examInfo,
  downloadUrl,
  onDownload,
  onEdit,
  canEdit = false,
  className = "",
}) => {
  const { trackSummaryView, trackSummaryClick } = useAnalytics();
  const hasTrackedView = useRef(false);

  // Track view when component mounts or becomes visible
  useEffect(() => {
    const trackView = async () => {
      if (!hasTrackedView.current) {
        await trackSummaryView(id, examInfo);
        hasTrackedView.current = true;
      }
    };

    // Use Intersection Observer to track when card becomes visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTrackedView.current) {
            trackView();
          }
        });
      },
      { threshold: 0.5 } // Track when 50% of the card is visible
    );

    const element = document.getElementById(`summary-card-${id}`);
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [id, examInfo, trackSummaryView]);

  const handleDownloadClick = async () => {
    await trackSummaryClick(id, "download");

    if (onDownload) {
      onDownload();
    } else if (downloadUrl) {
      window.open(downloadUrl, "_blank");
    }
  };

  const handleViewClick = async () => {
    await trackSummaryClick(id, "view");
  };

  const handleEditClick = () => {
    if (onEdit) {
      onEdit();
    }
  };

  return (
    <div
      id={`summary-card-${id}`}
      className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {canEdit && (
              <button
                onClick={handleEditClick}
                className="text-blue-600 hover:text-blue-800 p-1 rounded"
                title="تعديل الملخص"
              >
                <Edit size={16} />
              </button>
            )}
          </div>

          {description && (
            <p className="text-gray-600 text-sm mb-3">{description}</p>
          )}

          {examInfo && (
            <div className="flex flex-wrap gap-2 mb-4">
              {examInfo.date && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  📅 {examInfo.date}
                </span>
              )}
              {examInfo.type && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  📝 {examInfo.type}
                </span>
              )}
              {examInfo.subject && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  📚 {examInfo.subject}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        {downloadUrl && (
          <button
            onClick={handleDownloadClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Download size={16} />
            تحميل
          </button>
        )}

        <button
          onClick={handleViewClick}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Eye size={16} />
          عرض
        </button>
      </div>
    </div>
  );
};
