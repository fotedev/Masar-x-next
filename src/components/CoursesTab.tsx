import React from "react";
import { GraduationCap, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/Button";
import { useCourses } from "@/hooks/useCourses";
import { CourseCard } from "./courses/CourseCard";

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  is_published: boolean;
  instructor_name: string;
  created_at: string;
  enrollments_count?: number;
}

interface CoursesTabProps {
  onCreateCourse?: () => void;
  onEditCourse?: (course: Course) => void;
  refreshKey?: number;
}

export const CoursesTab: React.FC<CoursesTabProps> = ({
  onCreateCourse,
  onEditCourse,
  refreshKey,
}) => {
  const t = useTranslations("adminDashboard.coursesTab");
  const tCommon = useTranslations("common");
  const { courses, loading, error, loadCourses, togglePublish, deleteCourse } =
    useCourses(refreshKey);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="mr-3 text-gray-600 dark:text-gray-400">
          {tCommon("loading")}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">⚠️ {error}</div>
        <Button onClick={loadCourses} variant="outline">
          {tCommon("error")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("title")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={onCreateCourse} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t("createCourse")}
        </Button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t("noCourses")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t("startFirstCourse")}
          </p>
          <Button onClick={onCreateCourse}>
            <Plus className="w-4 h-4 mr-2" />
            {t("createFirstCourse")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={onEditCourse as any}
              onDelete={deleteCourse}
              onTogglePublish={togglePublish}
            />
          ))}
        </div>
      )}
    </div>
  );
};
