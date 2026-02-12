"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "../../components/ui";
import { GraduationCap, Users, Star, Search } from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  is_published: boolean;
  created_at: string;
  instructor_name?: string;
  average_rating?: number;
  total_students?: number;
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "paid">("all");

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);

      // Fetch courses with instructor names and enrollment stats
      const { data: coursesData, error } = await supabase
        .from("courses")
        .select(
          `
          *,
          profiles:instructor_id (
            display_name
          ),
          enrollments (
            status
          ),
          reviews (
            rating
          )
        `,
        )
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (coursesData) {
        const processedCourses = coursesData.map((course) => {
          const activeEnrollments =
            (course.enrollments as { status: string }[] | undefined)?.filter(
              (e) => e.status === "active",
            ) || [];
          const reviews =
            (course.reviews as { rating: number }[] | undefined) || [];
          const averageRating =
            reviews.length > 0
              ? reviews.reduce((sum: number, r) => sum + r.rating, 0) /
                reviews.length
              : 0;

          const priceNumber =
            typeof course.price === "number"
              ? course.price
              : typeof course.price === "string"
                ? Number(course.price)
                : 0;

          return {
            ...course,
            price: Number.isFinite(priceNumber) ? priceNumber : 0,
            instructor_name: course.profiles?.display_name || "مدرب",
            average_rating: averageRating,
            total_students: activeEnrollments.length,
          };
        });

        setCourses(processedCourses);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.instructor_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const price =
      typeof course.price === "number" ? course.price : Number(course.price);
    const safePrice = Number.isFinite(price) ? price : 0;

    const matchesFilter =
      filter === "all" ||
      (filter === "free" && safePrice <= 0) ||
      (filter === "paid" && safePrice > 0);

    return matchesSearch && matchesFilter;
  });

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? "text-yellow-400 fill-current" : "text-gray-300"
            }`}
          />
        ))}
        <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
          ({rating.toFixed(1)})
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            جاري تحميل الكورسات...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          الكورسات المتاحة
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          اختر الكورس المناسب لك من بين مجموعة متنوعة من الكورسات المتميزة
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="البحث في الكورسات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            size="sm"
            className={
              filter === "all"
                ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background shadow-sm"
                : "opacity-80"
            }
          >
            الكل
          </Button>
          <Button
            variant={filter === "free" ? "default" : "outline"}
            onClick={() => setFilter("free")}
            size="sm"
            className={
              filter === "free"
                ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background shadow-sm"
                : "opacity-80"
            }
          >
            مجاني
          </Button>
          <Button
            variant={filter === "paid" ? "default" : "outline"}
            onClick={() => setFilter("paid")}
            size="sm"
            className={
              filter === "paid"
                ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background shadow-sm"
                : "opacity-80"
            }
          >
            مدفوع
          </Button>
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            لا توجد كورسات متاحة
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || filter !== "all"
              ? "جرب تغيير معايير البحث أو الفلترة"
              : "سيتم إضافة كورسات جديدة قريباً"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <Card
              key={course.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/courses/${course.id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={course.price === 0 ? "secondary" : "default"}>
                    {course.price === 0 ? "مجاني" : `${course.price} جنيه`}
                  </Badge>
                </div>
                <CardTitle className="text-xl line-clamp-2">
                  {course.title}
                </CardTitle>
                <CardDescription className="line-clamp-3">
                  {course.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Users className="w-4 h-4 ml-1" />
                    {course.total_students} طالب
                  </div>

                  {course.average_rating !== undefined &&
                    course.average_rating > 0 &&
                    renderStars(course.average_rating)}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      مدرب: {course.instructor_name}
                    </span>
                    <Button size="sm">عرض التفاصيل</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats Footer */}
      <div className="mt-12 bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {courses.length}
            </div>
            <div className="text-gray-600 dark:text-gray-400">كورس متاح</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 mb-1">
              {courses.filter((c) => c.price === 0).length}
            </div>
            <div className="text-gray-600 dark:text-gray-400">كورس مجاني</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {courses.reduce((sum, c) => sum + (c.total_students || 0), 0)}
            </div>
            <div className="text-gray-600 dark:text-gray-400">طالب مسجل</div>
          </div>
        </div>
      </div>
    </div>
  );
}
