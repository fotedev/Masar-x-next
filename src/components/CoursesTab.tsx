import React from "react";
import { GraduationCap, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/Button";
import { useCourses } from "@/hooks/useCourses";
import { CourseCard } from "./courses/CourseCard";
import { CourseWithInstructor } from "@/types/database";

interface CoursesTabProps {
  onCreateCourse?: () => void;
  onEditCourse?: (course: CourseWithInstructor) => void;
}

export const CoursesTab: React.FC<CoursesTabProps> = ({
  onCreateCourse,
  onEditCourse,
}) => {
  const t = useTranslations("adminDashboard.coursesTab");
  const tCommon = useTranslations("common");
  const { courses, loading, togglePublish, deleteCourse } = useCourses();

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

  if (courses.length === 0 && !loading) {
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onEdit={(c) => onEditCourse?.(c)}
            onDelete={deleteCourse}
            onTogglePublish={togglePublish}
          />
        ))}
      </div>
    </div>
  );
};
