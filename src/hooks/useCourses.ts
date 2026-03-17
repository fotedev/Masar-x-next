import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";

import { CourseWithInstructor, CourseInsert, Course } from "@/types/database";

export function useCourses() {
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading: loading, refetch: fetchCourses } = useQuery({
    queryKey: ['courses'],
    staleTime: 5 * 60 * 1000, // 5 minutes (standardized)
    queryFn: async () => {
      try {
        // Fetch courses with instructor names and enrollment/review stats
        const { data: coursesData, error } = await supabase
          .from("courses")
          .select(`
            *,
            profiles:instructor_id (
              display_name,
              full_name,
              username
            ),
            enrollments (
              status
            ),
            reviews (
              rating
            )
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        interface RawCourse extends Course {
          profiles: {
            display_name: string | null;
            full_name: string | null;
            username: string | null;
          } | null;
          enrollments: { status: string }[] | null;
          reviews: { rating: number }[] | null;
        }

        const rawCourses = (coursesData as unknown as RawCourse[]) || [];

        return rawCourses.map((course) => {
          const activeEnrollments = course.enrollments?.filter(
            (e) => e.status === "active"
          ) || [];
          const reviews = course.reviews || [];
          const averageRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

          const instructor = course.profiles;
          const instructorName = instructor?.display_name || instructor?.full_name || instructor?.username || "مدرب";

          return {
            ...course,
            instructor_name: instructorName,
            enrollments_count: activeEnrollments.length,
            total_students: activeEnrollments.length,
            average_rating: averageRating,
          } as CourseWithInstructor;
        });
      } catch (error) {
        logger.error("Failed to fetch courses", error);
        return [];
      }
    }
  });

  const addCourseMutation = useMutation({
    mutationFn: async (course: CourseInsert) => {
      const { error } = await supabase.from("courses").insert(course);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success("تم إضافة الكورس بنجاح");
    },
    onError: (error) => {
      logger.error("Failed to add course", error);
      toast.error("فشل في إضافة الكورس");
    }
  });

  const updateCourseMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<Course> }) => {
      const { error } = await supabase.from("courses").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success("تم تحديث الكورس بنجاح");
    },
    onError: (error) => {
      logger.error("Failed to update course", error);
      toast.error("فشل في تحديث الكورس");
    }
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, is_published }: { id: string, is_published: boolean }) => {
      const { error } = await supabase.from("courses").update({ is_published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success("تم تحديث حالة النشر");
    },
    onError: (error) => {
      logger.error("Failed to toggle publish status", error);
      toast.error("فشل في تغيير حالة النشر");
    }
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success("تم حذف الكورس بنجاح");
    },
    onError: (error) => {
      logger.error("Failed to delete course", error);
      toast.error("فشل في حذف الكورس");
    }
  });

  return {
    courses: courses as CourseWithInstructor[],
    loading,
    fetchCourses: () => fetchCourses(),
    addCourse: (course: CourseInsert) => addCourseMutation.mutateAsync(course),
    updateCourse: (id: string, updates: Partial<Course>) => 
      updateCourseMutation.mutateAsync({ id, updates }),
    togglePublish: (id: string, currentStatus: boolean) => 
      togglePublishMutation.mutateAsync({ id, is_published: !currentStatus }),
    deleteCourse: (id: string) => deleteCourseMutation.mutateAsync(id),
  };
}
