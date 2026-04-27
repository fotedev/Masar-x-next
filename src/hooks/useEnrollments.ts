import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { queryCache, cacheKeys, cacheTTL } from "@/lib/queryCache";
import { toast } from "sonner";

interface Enrollment {
  id: string;
  status: "pending" | "active" | "rejected";
  payment_screenshot_url?: string;
  created_at: string;
  course_id: string;
  course_title: string;
  student_name: string;
  instructor_id?: string;
}

interface UseEnrollmentsProps {
  instructorId?: string;
}

export function useEnrollments({ instructorId }: UseEnrollmentsProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchEnrollments = useCallback(
    async (skipCache = false) => {
      try {
        setLoading(true);
        const cacheKey = cacheKeys.enrollments(instructorId);

        if (!skipCache) {
          const cached = queryCache.get<Enrollment[]>(cacheKey);
          if (cached) {
            setEnrollments(cached);
            setLoading(false);
            return;
          }
        }

        let query = supabase.from("enrollments").select(`
          *,
          courses!inner (
            title,
            instructor_id
          ),
          profiles:student_id (
            display_name
          )
        `);

        if (instructorId) {
          query = query.eq("courses.instructor_id", instructorId);
        }

        const { data, error } = await query.order("created_at", {
          ascending: false,
        });

        if (error) throw error;

        if (data) {
          interface RawEnrollment {
            id: string;
            status: "pending" | "active" | "rejected";
            payment_screenshot_url?: string;
            created_at: string;
            course_id: string;
            student_id: string;
            courses?: {
              title: string;
              instructor_id: string;
            };
            profiles?: {
              display_name: string;
            };
          }

          const formattedData = (data as RawEnrollment[]).map((e) => ({
            ...e,
            course_title: e.courses?.title || "كورس غير محدد",
            student_name: e.profiles?.display_name || "طالب",
            instructor_id: e.courses?.instructor_id,
          }));
          setEnrollments(formattedData);
          queryCache.set(cacheKey, formattedData, cacheTTL.enrollments);
        }
      } catch {
        toast.error("حدث خطأ في تحميل طلبات التسجيل");
      } finally {
        setLoading(false);
      }
    },
    [instructorId],
  );

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const handleAction = async (
    enrollmentId: string,
    action: "approve" | "reject",
  ) => {
    try {
      setProcessing(enrollmentId);
      const newStatus = action === "approve" ? "active" : "rejected";

      const { error } = await supabase
        .from("enrollments")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      toast.success(
        action === "approve" ? "تم قبول الطلب بنجاح" : "تم رفض الطلب",
      );

      queryCache.delete(cacheKeys.enrollments(instructorId));
      fetchEnrollments(true);
    } catch {
      toast.error("حدث خطأ في معالجة الطلب");
    } finally {
      setProcessing(null);
    }
  };

  return {
    enrollments,
    loading,
    processing,
    handleAction,
    refetch: fetchEnrollments,
  };
}
