import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  is_published: boolean;
  instructor_name: string;
  created_at: string;
  enrollments_count?: number;
  instructor_id: string;
}

export function useCourses(refreshKey?: number) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false });

      if (coursesError) throw coursesError;

      if (!coursesData || coursesData.length === 0) {
        setCourses([]);
        return;
      }

      const instructorIds = [
        ...new Set(coursesData.map((c: any) => c.instructor_id)),
      ].filter((id): id is string => typeof id === "string" && id.length > 0);

      const { data: profilesData, error: profilesError } = instructorIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", instructorIds)
        : { data: [], error: null };

      const courseIds = coursesData.map((c: any) => c.id);
      const { data: enrollmentsData, error: enrollmentsError } = courseIds.length
        ? await supabase
            .from("enrollments")
            .select("course_id, status")
            .in("course_id", courseIds)
        : { data: [], error: null };

      if (profilesError || enrollmentsError) {
        throw profilesError || enrollmentsError;
      }

      const processedCourses = (coursesData as any[]).map((course) => {
        const instructor = (profilesData as any[])?.find((p: any) => p.id === course.instructor_id);
        const courseEnrollments = (enrollmentsData as any[])?.filter((e: any) => e.course_id === course.id) ?? [];
        const activeEnrollments = courseEnrollments.filter((e: any) => e.status === "active");

        const priceNumber = typeof course.price === "number" ? course.price : Number(course.price) || 0;

        return {
          ...course,
          price: Number.isFinite(priceNumber) ? priceNumber : 0,
          instructor_name: instructor?.full_name || instructor?.username || "مدرب",
          enrollments_count: activeEnrollments.length,
        };
      });

      setCourses(processedCourses);
    } catch (e) {
      console.error("Failed to load courses", e);
      setError("حدث خطأ في تحميل الكورسات");
      toast.error("حدث خطأ في تحميل الكورسات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, [refreshKey]);

  const togglePublish = async (courseId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("courses")
        .update({ is_published: !currentStatus })
        .eq("id", courseId);

      if (error) throw error;

      setCourses((prev) =>
        prev.map((course) =>
          course.id === courseId ? { ...course, is_published: !currentStatus } : course
        )
      );
      toast.success("تم تحديث حالة النشر");
    } catch {
      toast.error("فشل في تغيير حالة النشر");
    }
  };

  const deleteCourse = async (courseId: string) => {
    try {
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;
      setCourses((prev) => prev.filter((course) => course.id !== courseId));
      toast.success("تم حذف الكورس بنجاح");
    } catch {
      toast.error("فشل في حذف الكورس");
    }
  };

  return {
    courses,
    loading,
    error,
    loadCourses,
    togglePublish,
    deleteCourse,
  };
}
