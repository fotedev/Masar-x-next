import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Plus,
  Edit,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/Card";
import { Badge } from "./ui/Badge";

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
}

export const CoursesTab: React.FC<CoursesTabProps> = ({
  onCreateCourse,
  onEditCourse,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);

      // First get courses
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });

      if (coursesError) throw coursesError;

      if (!coursesData || coursesData.length === 0) {
        setCourses([]);
        return;
      }

      // Get instructor names separately
      const instructorIds = [
        ...new Set(coursesData.map((c) => c.instructor_id)),
      ];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", instructorIds);

      // Get enrollments for each course
      const courseIds = coursesData.map((c) => c.id);
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("course_id, status")
        .in("course_id", courseIds);

      if (coursesError || profilesError || enrollmentsError) {
        throw coursesError || profilesError || enrollmentsError;
      }

      // Combine the data
      const processedCourses = coursesData.map((course) => {
        const instructor = profilesData?.find(
          (p) => p.id === course.instructor_id,
        );
        const courseEnrollments =
          enrollmentsData?.filter((e) => e.course_id === course.id) || [];
        const activeEnrollments = courseEnrollments.filter(
          (e: any) => e.status === "active",
        );

        const priceNumber =
          typeof course.price === "number"
            ? course.price
            : typeof course.price === "string"
              ? Number(course.price)
              : 0;

        return {
          ...course,
          price: Number.isFinite(priceNumber) ? priceNumber : 0,
          instructor_name: instructor?.display_name || "مدرب",
          enrollments_count: activeEnrollments.length,
        };
      });

      setCourses(processedCourses);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (
    courseId: string,
    currentStatus: boolean,
  ) => {
    try {
      const { error } = await supabase
        .from("courses")
        .update({ is_published: !currentStatus })
        .eq("id", courseId);

      if (error) throw error;

      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId
            ? { ...course, is_published: !currentStatus }
            : course,
        ),
      );
    } catch {
      alert("فشل في تغيير حالة النشر");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (
      !confirm(
        "هل أنت متأكد من حذف هذا الكورس؟ لا يمكن التراجع عن هذا الإجراء.",
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);

      if (error) throw error;

      setCourses((prev) => prev.filter((course) => course.id !== courseId));
    } catch {
      alert("فشل في حذف الكورس");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="mr-3 text-gray-600 dark:text-gray-400">
          جاري تحميل الكورسات...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">⚠️ {error}</div>
        <Button onClick={loadCourses} variant="outline">
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            إدارة الكورسات
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            إنشاء وإدارة الكورسات المدفوعة
          </p>
        </div>
        <Button onClick={onCreateCourse} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          إنشاء كورس جديد
        </Button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            لا توجد كورسات
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            ابدأ بإنشاء أول كورس لك
          </p>
          <Button onClick={onCreateCourse}>
            <Plus className="w-4 h-4 mr-2" />
            إنشاء الكورس الأول
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={course.price === 0 ? "secondary" : "default"}>
                    {course.price === 0 ? "مجاني" : `${course.price} جنيه`}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        handleTogglePublish(course.id, course.is_published)
                      }
                      className={`p-1 rounded-full transition-colors ${
                        course.is_published
                          ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          : "text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                      title={course.is_published ? "إلغاء النشر" : "نشر الكورس"}
                    >
                      {course.is_published ? (
                        <ToggleRight className="w-5 h-5" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <CardTitle className="text-lg line-clamp-2">
                  {course.title}
                </CardTitle>
                <CardDescription className="line-clamp-3">
                  {course.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>المدرب: {course.instructor_name}</span>
                    <span>{course.enrollments_count} طالب</span>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditCourse?.(course)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          window.open(`/courses/${course.id}`, "_blank")
                        }
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteCourse(course.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
