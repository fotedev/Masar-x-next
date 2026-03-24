"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { Star, MessageSquare, Clock, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { confirmToast } from "@/lib/confirmToast";
import { useReviews } from "@/hooks/useReviews";
import { ReviewForm } from "@/components/reviews/ReviewForm";

// Decomposed components
import { CourseHero } from "@/components/courses/CourseHero";
import { CourseContent } from "@/components/courses/CourseContent";
import { ReviewSection } from "@/components/courses/ReviewSection";

const getErrorMessage = (err: unknown): string | null => {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === "string" ? msg : null;
  }
  return null;
};

interface Course {
  id: string;
  title: string;
  description: string;
  instructor_id: string;
  price: number;
  is_published: boolean;
  created_at: string;
  instructor_name?: string;
}

type CourseRow = Course & {
  profiles?: {
    display_name?: string | null;
  } | null;
};

type ReviewDetailsRow = {
  id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
  full_name?: string | null;
  username?: string | null;
};

interface Enrollment {
  id: string;
  status: "pending" | "active" | "rejected";
  payment_screenshot_url?: string;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  content?: string;
  created_at: string;
  student_name?: string;
}

interface CourseSummary {
  id: string;
  title: string;
  content: string;
  order_index: number;
  created_at: string;
}

interface CourseVideo {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  language: "ar" | "en";
  duration?: number;
  order_index: number;
  created_at: string;
}

interface CourseFile {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type: string;
  file_size?: number;
  order_index: number;
  created_at: string;
}

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const { user, adminRole } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summaries, setSummaries] = useState<CourseSummary[]>([]);
  const [videos, setVideos] = useState<CourseVideo[]>([]);
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  const [showReviewForm, setShowReviewForm] = useState(false);

  const [, setEditingSummary] = useState<CourseSummary | null>(null);
  const [, setEditingVideo] = useState<CourseVideo | null>(null);
  const [, setEditingFile] = useState<CourseFile | null>(null);

  const isInstructor = () => {
    if (!user || !course) return false;
    return user.id === course.instructor_id || adminRole === "doctor";
  };

  const fetchCourseData = useCallback(async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*, profiles:instructor_id (display_name)")
        .eq("id", courseId)
        .single();

      if (courseError) throw courseError;

      if (courseData) {
        const typedCourseData = courseData as CourseRow;
        const isInstructorUser = user && user.id === courseData.instructor_id;
        const isDoctorAdmin = adminRole === "doctor";
        if (!courseData.is_published && !isInstructorUser && !isDoctorAdmin) {
          throw new Error("Course is not published");
        }

        setCourse({
          ...typedCourseData,
          instructor_name: typedCourseData.profiles?.display_name || "مدرب",
        });

        if (user) {
          const { data: enrollmentData } = await supabase
            .from("enrollments")
            .select("*")
            .eq("student_id", user.id)
            .eq("course_id", courseId)
            .maybeSingle();
          setEnrollment(enrollmentData);
        }

        const { data: reviewsData } = await supabase
          .from("review_details")
          .select("*")
          .eq("course_id", courseId)
          .order("created_at", { ascending: false });

        if (reviewsData) {
          setReviews(
            (reviewsData as ReviewDetailsRow[]).map((review) => ({
              id: review.id,
              rating: review.rating,
              content: review.comment || undefined,
              created_at: review.created_at,
              student_name: review.full_name || review.username || "طالب",
            })),
          );
        }

        const { data: summariesData } = await supabase
          .from("course_summaries")
          .select("*")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true });
        if (summariesData) setSummaries(summariesData);

        const { data: videosData } = await supabase
          .from("course_videos")
          .select("*")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true });
        if (videosData) setVideos(videosData);

        const { data: filesData } = await supabase
          .from("course_files")
          .select("*")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true });
        if (filesData) setFiles(filesData);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "حدث خطأ في تحميل بيانات الكورس");
    } finally {
      setLoading(false);
    }
  }, [courseId, user, adminRole]);

  useEffect(() => {
    if (courseId) fetchCourseData();
  }, [courseId, fetchCourseData]);

  const { addReview } = useReviews(courseId, "course");

  const handleReviewSubmit = async (content: string, rating: number) => {
    if (!user) return;
    try {
      await addReview({
        course_id: courseId,
        user_id: user.id,
        rating,
        comment: content,
      });
      toast.success("تم إضافة تقييمك بنجاح");
      setShowReviewForm(false);
      fetchCourseData();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "حدث خطأ أثناء إضافة التقييم");
    }
  };

  const handleSubscribe = async () => {
    if (!user || !course || !paymentScreenshot) return;
    try {
      setUploadingScreenshot(true);
      const fileExt = paymentScreenshot.name.split(".").pop();
      const fileName = `${user.id}/${course.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, paymentScreenshot);
      if (uploadError) throw uploadError;

      const { error: enrollmentError } = await supabase
        .from("enrollments")
        .insert({
          student_id: user.id,
          course_id: course.id,
          payment_screenshot_url: uploadData.path,
          status: "pending",
        });
      if (enrollmentError) throw enrollmentError;

      toast.success("تم إرسال طلب التسجيل بنجاح!");
      setShowSubscribeModal(false);
      setPaymentScreenshot(null);
      fetchCourseData();
    } catch {
      toast.error("حدث خطأ في إرسال طلب التسجيل");
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleDeleteSummary = async (summaryId: string) => {
    const confirmed = await confirmToast("هل أنت متأكد من حذف هذا الملخص؟");
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from("course_summaries")
        .delete()
        .eq("id", summaryId);
      if (error) throw error;
      toast.success("تم حذف الملخص بنجاح!");
      fetchCourseData();
    } catch {
      toast.error("حدث خطأ في حذف الملخص");
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    const confirmed = await confirmToast("هل أنت متأكد من حذف هذا الفيديو؟");
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from("course_videos")
        .delete()
        .eq("id", videoId);
      if (error) throw error;
      toast.success("تم حذف الفيديو بنجاح!");
      fetchCourseData();
    } catch {
      toast.error("حدث خطأ في حذف الفيديو");
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    const confirmed = await confirmToast("هل أنت متأكد من حذف هذا الملف؟");
    if (!confirmed) return;
    try {
      const { error = null } = await supabase
        .from("course_files")
        .delete()
        .eq("id", fileId);
      if (error) throw error;
      toast.success("تم حذف الملف بنجاح!");
      fetchCourseData();
    } catch {
      toast.error("حدث خطأ في حذف الملف");
    }
  };

  const getEnrollmentStatus = () => {
    if (!user || !enrollment) return "not_enrolled";
    return enrollment.status;
  };

  const renderActionButton = () => {
    const status = getEnrollmentStatus();
    if (!user)
      return (
        <Button onClick={() => router.push("/login")} className="w-full">
          تسجيل الدخول للتسجيل
        </Button>
      );
    switch (status) {
      case "active":
        return (
          <div className="space-y-3">
            <Button
              onClick={() => router.push("/ai-assistant")}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <MessageSquare className="w-4 h-4 ml-2" />
              بدء ZANE AI
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowReviewForm(true)}
              className="w-full"
            >
              <Star className="w-4 h-4 ml-2" />
              تقييم الكورس
            </Button>
          </div>
        );
      case "pending":
        return (
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-yellow-800 font-medium">طلبك قيد المراجعة</p>
          </div>
        );
      case "rejected":
        return (
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-red-800 font-medium">تم رفض طلب التسجيل</p>
            <Button
              onClick={() => setShowSubscribeModal(true)}
              className="mt-3"
              variant="outline"
            >
              إعادة المحاولة
            </Button>
          </div>
        );
      default:
        return (
          <Button
            onClick={() => setShowSubscribeModal(true)}
            className="w-full"
          >
            التسجيل في الكورس
          </Button>
        );
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );

  if (!course)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            الكورس غير موجود
          </h1>
        </div>
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto p-6 space-y-6"
    >
      <CourseHero
        course={course}
        enrollmentStatus={getEnrollmentStatus()}
        renderActionButton={renderActionButton}
      />

      <CourseContent
        enrollmentStatus={getEnrollmentStatus()}
        isInstructor={isInstructor()}
        summaries={summaries}
        videos={videos}
        files={files}
        onOpenSummaryModal={(s) => {
          if (s) setEditingSummary(s);
          else setEditingSummary(null);
        }}
        onDeleteSummary={handleDeleteSummary}
        onOpenVideoModal={(v) => {
          if (v) setEditingVideo(v);
          else setEditingVideo(null);
        }}
        onDeleteVideo={handleDeleteVideo}
        onOpenFileModal={(f) => {
          if (f) setEditingFile(f);
          else setEditingFile(null);
        }}
        onDeleteFile={handleDeleteFile}
        onDownloadFile={(fileUrl) => {
          const { data } = supabase.storage
            .from("course-materials")
            .getPublicUrl(fileUrl);
          window.open(data.publicUrl, "_blank");
        }}
      />

      <ReviewSection reviews={reviews} />

      <AnimatePresence>
        {showSubscribeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>التسجيل في الكورس</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setPaymentScreenshot(e.target.files?.[0] || null)
                  }
                  className="w-full p-2 border rounded-lg"
                />
                <div className="flex gap-3">
                  <Button
                    onClick={handleSubscribe}
                    disabled={!paymentScreenshot || uploadingScreenshot}
                    className="flex-1"
                  >
                    {uploadingScreenshot ? "جاري الرفع..." : "تأكيد وإرسال"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSubscribeModal(false)}
                    className="flex-1"
                  >
                    إلغاء
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </AnimatePresence>

      {showReviewForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-white dark:bg-gray-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>تقييم الكورس</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowReviewForm(false)}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent>
              <ReviewForm
                user={user}
                onSubmit={handleReviewSubmit}
                onCancel={() => setShowReviewForm(false)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
