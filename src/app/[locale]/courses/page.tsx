"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { useCourses } from "@/hooks/useCourses";
import { useCoursesFilter } from "@/hooks/useCoursesFilter";

export default function CoursesPage() {
  const t = useTranslations("courses");
  const router = useRouter();
  const { courses, loading } = useCourses();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "paid">("all");

  const { filteredCourses, stats } = useCoursesFilter({
    courses,
    searchTerm,
    filter,
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
                      course.average_rating !== null &&
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
              {stats.total}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {t("courseCount", { count: stats.total })}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 mb-1">
              {stats.free}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {t("freeCourseCount", {
                count: stats.free,
              })}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {stats.totalStudents}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {t("studentCount", {
                count: stats.totalStudents,
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
