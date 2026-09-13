import { useState, useEffect, type FC } from "react";
import { Users, MessageSquare, Eye, MousePointer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { analyticsHelpers } from "@/lib/analyticsHelpers";

interface AdminAnalyticsPageProps {
  onNavigate: (page: string) => void;
}

interface AnalyticsSummary {
  totalUsers: number;
  totalMessages: number;
  totalViews: number;
  totalClicks: number;
  topContentTypes: Array<{
    type: string;
    count: number;
  }>;
  recentActivity: Array<{
    action: string;
    content_type: string;
    created_at: string;
  }>;
}

export const AdminAnalyticsPage: FC<AdminAnalyticsPageProps> = ({
  onNavigate,
}) => {
  const locale = useLocale();
  const t = useTranslations("adminDashboard.analytics");
  const tNav = useTranslations("nav");
  const assistantName = tNav("assistant");
  // ar-EG keeps the Arabic-Indic digits + Gregorian calendar the page
  // always rendered; en-US switches Latin digits for English admins.
  const intlLocale = locale === "ar" ? "ar-EG" : "en-US";
  const { isAdmin } = useAuth();
  const isAdminLoading = false; // AuthContext handles admin state within the main loading state
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat(intlLocale).format(value);
  };

  const formatDateTime = (value: string) => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString(intlLocale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getActionLabel = (action: string) => {
    const a = (action || "").toLowerCase();
    switch (a) {
      case "page_view":
        return t("action.page_view");
      case "click":
        return t("action.click");
      case "ai_interaction":
        return t("action.ai_interaction");
      case "user_login":
        return t("action.user_login");
      case "user_logout":
        return t("action.user_logout");
      case "content_view":
        return t("action.content_view");
      case "summary_click":
        return t("action.summary_click");
      default:
        return action || t("action.fallback");
    }
  };

  const getContentLabel = (contentType: string) => {
    const t2 = (contentType || "").toLowerCase();
    if (t2 === "ai_assistant") return `${assistantName} AI`;
    switch (t2) {
      case "summary":
        return t("contentType.summary");
      case "course":
        return t("contentType.course");
      case "quiz":
        return t("contentType.quiz");
      case "page":
        return t("contentType.page");
      case "login":
        return t("contentType.login");
      case "logout":
        return t("contentType.logout");
      case "unknown":
        return t("contentType.unknown");
      default:
        return contentType || t("contentType.fallback");
    }
  };

  const actionBadgeClass = (action: string) => {
    const a = (action || "").toLowerCase();
    if (a === "page_view")
      return "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200";
    if (a === "click")
      return "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200";
    if (a === "ai_interaction")
      return "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200";
    if (a === "user_login")
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200";
    if (a === "user_logout")
      return "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200";
    return "bg-gray-50 text-gray-700 dark:bg-gray-900/40 dark:text-gray-200";
  };

  useEffect(() => {
    const loadAnalyticsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if user is admin (using the already loaded isAdmin state from useAuth)
        if (!isAdminLoading && !isAdmin) {
          setError(t("errors.unauthorized"));
          return;
        }

        // Fetch real analytics data from the stored procedure
        const summary = await analyticsHelpers.getAdminAnalyticsSummary();

        if (summary) {
          setAnalytics({
            totalUsers: summary.totalUsers || 0,
            totalMessages: summary.totalMessages || 0,
            totalViews: summary.totalViews || 0,
            totalClicks: summary.totalClicks || 0,
            topContentTypes: summary.topContentTypes || [],
            recentActivity: summary.recentActivity || [],
          });
        } else {
          // Fallback to placeholder data if procedure returns null
          const placeholderSummary = {
            totalUsers: 0,
            totalMessages: 0,
            totalViews: 0,
            totalClicks: 0,
            topContentTypes: [],
            recentActivity: [],
          };
          setAnalytics(placeholderSummary);
        }
      } catch {
        setError(t("errors.loadFailed"));
      } finally {
        setLoading(false);
      }
    };

    loadAnalyticsData();
  }, [isAdmin, isAdminLoading, t]);

  const loadAnalytics = async () => {
    // Keep this function for the retry button
    setLoading(true);
    setError(null);
    try {
      const summary = await analyticsHelpers.getAdminAnalyticsSummary();
      if (summary) {
        setAnalytics({
          totalUsers: summary.totalUsers || 0,
          totalMessages: summary.totalMessages || 0,
          totalViews: summary.totalViews || 0,
          totalClicks: summary.totalClicks || 0,
          topContentTypes: summary.topContentTypes || [],
          recentActivity: summary.recentActivity || [],
        });
      }
    } catch {
      setError(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (isAdminLoading || loading) {
    return (
      <div className="min-h-dvh-safe bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              {t("loading")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh-safe bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t("retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh-safe bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("title")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t("cards.activeUsers")}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(analytics?.totalUsers || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-green-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t("cards.assistantMessages")}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(analytics?.totalMessages || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-purple-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t("cards.views")}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(analytics?.totalViews || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <MousePointer className="h-8 w-8 text-orange-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t("cards.clicks")}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(analytics?.totalClicks || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Content Types */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {t("topContent")}
          </h2>
          <div className="space-y-3">
            {analytics?.topContentTypes &&
            analytics.topContentTypes.length > 0 ? (
              analytics.topContentTypes.map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className="flex items-center justify-between rounded-md border border-gray-100 dark:border-gray-700 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-bold">
                      {formatNumber(index + 1)}
                    </span>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {getContentLabel(item.type)}
                      <span className="text-gray-400 dark:text-gray-500 font-normal">
                        {" "}
                        ({item.type})
                      </span>
                    </div>
                  </div>
                  <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-semibold">
                    {formatNumber(item.count)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                {t("noData")}
              </p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {t("recentActivity")}
          </h2>
          {analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
            <div className="space-y-2">
              {analytics.recentActivity.map((activity, index) => (
                <div
                  key={`${activity.created_at}-${index}`}
                  className="flex items-start justify-between gap-4 rounded-md border border-gray-100 dark:border-gray-700 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${actionBadgeClass(
                          activity.action,
                        )}`}
                      >
                        {getActionLabel(activity.action)}
                      </span>
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {getContentLabel(activity.content_type)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {activity.action} / {activity.content_type}
                    </div>
                  </div>

                  <div className="shrink-0 text-left">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(activity.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              {t("noRecentActivity")}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => onNavigate("home")}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
          >
            {t("backHome")}
          </button>
        </div>
      </div>
    </div>
  );
};
