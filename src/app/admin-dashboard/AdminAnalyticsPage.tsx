import React, { useState, useEffect } from "react";
import { Users, MessageSquare, Eye, MousePointer } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { chatHelpers } from "../../lib/supabase";

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

export const AdminAnalyticsPage: React.FC<AdminAnalyticsPageProps> = ({
  onNavigate,
}) => {
  const { isAdmin, isAdminLoading } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalyticsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if user is admin
        if (!isAdmin) {
          setError("غير مصرح لك بالوصول إلى هذه الصفحة");
          return;
        }

        // Fetch real analytics data from the stored procedure
        const summary = await chatHelpers.getAdminAnalyticsSummary();

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
      } catch (err) {
        console.error("Error loading analytics:", err);
        setError("حدث خطأ في تحميل الإحصائيات");
      } finally {
        setLoading(false);
      }
    };

    loadAnalyticsData();
  }, [isAdmin]);

  const loadAnalytics = async () => {
    // Keep this function for the retry button
    setLoading(true);
    setError(null);
    try {
      const summary = await chatHelpers.getAdminAnalyticsSummary();
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
    } catch (err) {
      console.error("Error reloading analytics:", err);
      setError("حدث خطأ في تحميل الإحصائيات");
    } finally {
      setLoading(false);
    }
  };

  if (isAdminLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              جاري تحميل الإحصائيات...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            لوحة الإحصائيات الإدارية
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            مراقبة استخدام التطبيق وتفاعلات المستخدمين
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  المستخدمون النشطون
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analytics?.totalUsers || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-green-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  رسائل المساعد
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analytics?.totalMessages || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-purple-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  المشاهدات
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analytics?.totalViews || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <MousePointer className="h-8 w-8 text-orange-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  النقرات
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analytics?.totalClicks || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Content Types */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            أكثر المحتويات شعبية
          </h2>
          <div className="space-y-3">
            {analytics?.topContentTypes?.map((item, index) => (
              <div
                key={item.type}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  <span className="text-lg font-medium text-gray-900 dark:text-white mr-3">
                    #{index + 1}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {item.type}
                  </span>
                </div>
                <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full text-sm">
                  {item.count}
                </span>
              </div>
            )) || (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                لا توجد بيانات متاحة
              </p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            النشاط الأخير
          </h2>
          <div className="space-y-3">
            {analytics?.recentActivity?.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    <span className="font-medium">{activity.action}</span> على{" "}
                    <span className="font-medium">{activity.content_type}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(activity.created_at).toLocaleString("ar-EG")}
                  </p>
                </div>
              </div>
            )) || (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                لا توجد نشاطات حديثة
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => onNavigate("home")}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    </div>
  );
};
