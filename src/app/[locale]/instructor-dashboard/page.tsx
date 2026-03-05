"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui";
import { EnrollmentsTab } from "../../components/EnrollmentsTab";
import { Users, Star, Clock, TrendingUp, BookOpen } from "lucide-react";

// Enrollment interface is now handled by EnrollmentsTab component

interface CourseStats {
  id: string;
  title: string;
  active_students: number;
  pending_enrollments: number;
  average_rating: number;
  total_reviews: number;
}

interface CourseEnrollment {
  status: string;
}

interface CourseReview {
  rating: number;
}

interface CourseRow {
  id: string;
  title: string;
  enrollments?: CourseEnrollment[] | null;
  reviews?: CourseReview[] | null;
}

export default function InstructorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CourseStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Enrollment fetching is now handled by EnrollmentsTab component

      // Fetch course statistics
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select(
          `
          id,
          title,
          enrollments (
            status
          ),
          reviews (
            rating
          )
        `,
        )
        .eq("instructor_id", user.id)
        .eq("is_published", true);

      if (coursesError) throw coursesError;

      if (coursesData) {
        const statsData = (coursesData as CourseRow[]).map((course) => {
          const activeEnrollments =
            course.enrollments?.filter((e) => e.status === "active") || [];
          const pendingEnrollments =
            course.enrollments?.filter((e) => e.status === "pending") || [];
          const reviews = course.reviews || [];
          const averageRating =
            reviews.length > 0
              ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
              : 0;

          return {
            id: course.id,
            title: course.title,
            active_students: activeEnrollments.length,
            pending_enrollments: pendingEnrollments.length,
            average_rating: averageRating,
            total_reviews: reviews.length,
          };
        });

        setStats(statsData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  // Enrollment actions are now handled by EnrollmentsTab component

  // Filtering is now handled by EnrollmentsTab component

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            جاري تحميل لوحة التحكم...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          لوحة تحكم المدرب
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          إدارة كورساتك وطلبات التسجيل
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  إجمالي الكورسات
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  طلبات معلقة
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.reduce((acc, s) => acc + s.pending_enrollments, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  إجمالي الطلاب
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.reduce(
                    (sum, course) => sum + course.active_students,
                    0,
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Star className="h-8 w-8 text-purple-600" />
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  متوسط التقييم
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.length > 0
                    ? (
                        stats.reduce(
                          (sum, course) => sum + course.average_rating,
                          0,
                        ) / stats.length
                      ).toFixed(1)
                    : "0.0"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="enrollments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="enrollments" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            إدارة التسجيلات
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            إحصائيات الكورسات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enrollments" className="space-y-4">
          <EnrollmentsTab instructorId={user?.id} />
        </TabsContent>

        {/* Course Statistics */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {course.active_students}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        طالب نشط
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {course.pending_enrollments}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        طلب معلق
                      </div>
                    </div>
                    <div className="text-center col-span-2">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-5 h-5 text-yellow-400 fill-current" />
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {course.average_rating.toFixed(1)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {course.total_reviews} تقييم
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {stats.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  لم تقم بإنشاء أي كورسات بعد
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Payment Screenshot Modal is now handled by EnrollmentsTab component */}
    </div>
  );
}
