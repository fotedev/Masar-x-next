"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@/components/ui";
import { GraduationCap, Users, Star, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { motion } from "framer-motion";

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
  const t = useTranslations("courses");
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "paid">("all");

  const fetchCourses = useCallback(async () => {
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
        const processedCourses = coursesData.map(
          (course: (typeof coursesData)[number]) => {
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
              instructor_name: course.profiles?.display_name || t("instructor"),
              average_rating: averageRating,
              total_students: activeEnrollments.length,
            };
          },
        );

        setCourses(processedCourses);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

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
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center mb-8">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Skeleton className="flex-1 h-12 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="w-20 h-10 rounded-lg" />
            <Skeleton className="w-20 h-10 rounded-lg" />
            <Skeleton className="w-20 h-10 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-[300px]">
              <CardHeader>
                <Skeleton className="h-6 w-20 mb-4" />
                <Skeleton className="h-7 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-1/4" />
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-9 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-7xl mx-auto p-6"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {t("pageTitle")}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          {t("pageDescription")}
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
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
            {t("filterAll")}
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
            {t("filterFree")}
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
            {t("filterPaid")}
          </Button>
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t("noCourses")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || filter !== "all"
              ? t("noCoursesDescription")
              : t("noCoursesSoon")}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.05,
                delayChildren: 0.2,
              },
            },
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredCourses.map((course) => (
            <motion.div
              key={course.id}
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1 },
              }}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                className="hover:shadow-lg transition-shadow cursor-pointer h-full"
                onClick={() => router.push(`/courses/${course.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge
                      variant={course.price === 0 ? "secondary" : "default"}
                    >
                      {course.price === 0
                        ? t("free")
                        : `${course.price} ${t("currency")}`}
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
                      {t("studentCount", { count: course.total_students || 0 })}
                    </div>

                    {course.average_rating !== undefined &&
                      course.average_rating > 0 &&
                      renderStars(course.average_rating)}

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t("instructor")}: {course.instructor_name}
                      </span>
                      <Button size="sm">{t("viewDetails")}</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Stats Footer */}
      <div className="mt-12 bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {courses.length}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {t("courseCount", { count: courses.length })}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 mb-1">
              {courses.filter((c) => c.price === 0).length}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {t("freeCourseCount", {
                count: courses.filter((c) => c.price === 0).length,
              })}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {courses.reduce((sum, c) => sum + (c.total_students || 0), 0)}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {t("studentCount", {
                count: courses.reduce(
                  (sum, c) => sum + (c.total_students || 0),
                  0,
                ),
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
