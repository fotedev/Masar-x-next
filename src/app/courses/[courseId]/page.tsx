"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Textarea,
} from "../../../components/ui";
import {
  Star,
  Upload,
  Lock,
  Unlock,
  MessageSquare,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Video,
  Download,
  Play,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";

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
  const [submitting, setSubmitting] = useState(false);

  // Subscribe modal state
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  // Review state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  // Content management state
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [editingSummary, setEditingSummary] = useState<CourseSummary | null>(
    null,
  );
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summaryContent, setSummaryContent] = useState("");

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<CourseVideo | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoLanguage, setVideoLanguage] = useState<"ar" | "en">("ar");
  const [videoDuration, setVideoDuration] = useState("");

  const [showFileModal, setShowFileModal] = useState(false);
  const [editingFile, setEditingFile] = useState<CourseFile | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileDescription, setFileDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Helper to check if current user is the instructor or a doctor admin
  const isInstructor = () => {
    if (!user || !course) return false;
    return user.id === course.instructor_id || adminRole === "doctor";
  };

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId, user]);

  const fetchCourseData = async () => {
    if (!courseId) return;

    try {
      setLoading(true);

      // Fetch course with instructor name
      let query = supabase
        .from("courses")
        .select(
          `
          *,
          profiles:instructor_id (
            display_name
          )
        `,
        )
        .eq("id", courseId);

      // If user is not admin and not the instructor, only show published courses
      // We'll fetch the course first, then check permissions
      const { data: courseData, error: courseError } = await query.single();

      if (courseError) throw courseError;

      if (courseData) {
        // Check if course is published or if user has permission to see it
        const isInstructorUser = user && user.id === courseData.instructor_id;
        const isDoctorAdmin = adminRole === "doctor";

        if (!courseData.is_published && !isInstructorUser && !isDoctorAdmin) {
          throw new Error("Course is not published");
        }

        setCourse({
          ...courseData,
          instructor_name: courseData.profiles?.display_name || "مدرب",
        });

        // Fetch enrollment status if user is logged in
        if (user) {
          const { data: enrollmentData } = await supabase
            .from("enrollments")
            .select("*")
            .eq("student_id", user.id)
            .eq("course_id", courseId)
            .maybeSingle();

          setEnrollment(enrollmentData);
        }

        // Fetch reviews using review_details view
        const { data: reviewsData } = await supabase
          .from("review_details")
          .select("*")
          .eq("course_id", courseId)
          .order("created_at", { ascending: false });

        if (reviewsData) {
          setReviews(
            reviewsData.map((review) => ({
              ...review,
              student_name: review.full_name || review.username || "طالب",
            })),
          );
        }

        // Fetch course summaries
        const { data: summariesData } = await supabase
          .from("course_summaries")
          .select("*")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true });

        if (summariesData) {
          setSummaries(summariesData);
        }

        // Fetch course videos
        const { data: videosData } = await supabase
          .from("course_videos")
          .select("*")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true });

        if (videosData) {
          setVideos(videosData);
        }

        // Fetch course files
        const { data: filesData } = await supabase
          .from("course_files")
          .select("*")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true });

        if (filesData) {
          setFiles(filesData);
        }
      }
    } catch (error) {
      console.error("Error fetching course data:", error);
      toast.error("حدث خطأ في تحميل بيانات الكورس");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user || !course || !paymentScreenshot) return;

    try {
      setUploadingScreenshot(true);

      // Upload payment screenshot to private bucket
      const fileExt = paymentScreenshot.name.split(".").pop();
      const fileName = `${user.id}/${course.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, paymentScreenshot);

      if (uploadError) throw uploadError;

      // Create enrollment record
      const { error: enrollmentError } = await supabase
        .from("enrollments")
        .insert({
          student_id: user.id,
          course_id: course.id,
          payment_screenshot_url: uploadData.path,
          status: "pending",
        });

      if (enrollmentError) throw enrollmentError;

      toast.success("تم إرسال طلب التسجيل بنجاح! سيتم مراجعته من قبل المدرب.");
      setShowSubscribeModal(false);
      setPaymentScreenshot(null);

      // Refresh enrollment status
      fetchCourseData();
    } catch (error) {
      console.error("Error subscribing to course:", error);
      toast.error("حدث خطأ في إرسال طلب التسجيل");
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !course || reviewRating < 1 || reviewRating > 5) return;

    try {
      setSubmitting(true);

      const { error } = await supabase.from("reviews").insert({
        user_id: user.id,
        course_id: course.id,
        rating: reviewRating,
        content: reviewComment.trim() || null,
      });

      if (error) throw error;

      toast.success("تم إرسال التقييم بنجاح!");
      setShowReviewForm(false);
      setReviewRating(5);
      setReviewComment("");

      // Refresh reviews
      fetchCourseData();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error("حدث خطأ في إرسال التقييم");
    } finally {
      setSubmitting(false);
    }
  };

  // Summary management functions
  const handleSaveSummary = async () => {
    if (!course || !summaryTitle.trim() || !summaryContent.trim()) return;

    try {
      setSubmitting(true);

      const summaryData = {
        course_id: course.id,
        title: summaryTitle.trim(),
        content: summaryContent.trim(),
        order_index: editingSummary
          ? editingSummary.order_index
          : summaries.length,
      };

      if (editingSummary) {
        const { error } = await supabase
          .from("course_summaries")
          .update(summaryData)
          .eq("id", editingSummary.id);

        if (error) throw error;
        toast.success("تم تحديث الملخص بنجاح!");
      } else {
        const { error } = await supabase
          .from("course_summaries")
          .insert(summaryData);

        if (error) throw error;
        toast.success("تم إضافة الملخص بنجاح!");
      }

      setShowSummaryModal(false);
      setEditingSummary(null);
      setSummaryTitle("");
      setSummaryContent("");
      fetchCourseData();
    } catch (error) {
      console.error("Error saving summary:", error);
      toast.error("حدث خطأ في حفظ الملخص");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSummary = async (summaryId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الملخص؟")) return;

    try {
      const { error } = await supabase
        .from("course_summaries")
        .delete()
        .eq("id", summaryId);

      if (error) throw error;

      toast.success("تم حذف الملخص بنجاح!");
      fetchCourseData();
    } catch (error) {
      console.error("Error deleting summary:", error);
      toast.error("حدث خطأ في حذف الملخص");
    }
  };

  const openSummaryModal = (summary?: CourseSummary) => {
    if (summary) {
      setEditingSummary(summary);
      setSummaryTitle(summary.title);
      setSummaryContent(summary.content);
    } else {
      setEditingSummary(null);
      setSummaryTitle("");
      setSummaryContent("");
    }
    setShowSummaryModal(true);
  };

  // Video management functions
  const handleSaveVideo = async () => {
    if (!course || !videoTitle.trim() || !videoUrl.trim()) return;

    try {
      setSubmitting(true);

      const videoData = {
        course_id: course.id,
        title: videoTitle.trim(),
        description: videoDescription.trim() || null,
        video_url: videoUrl.trim(),
        language: videoLanguage,
        duration: videoDuration ? parseInt(videoDuration) : null,
        order_index: editingVideo ? editingVideo.order_index : videos.length,
      };

      if (editingVideo) {
        const { error } = await supabase
          .from("course_videos")
          .update(videoData)
          .eq("id", editingVideo.id);

        if (error) throw error;
        toast.success("تم تحديث الفيديو بنجاح!");
      } else {
        const { error } = await supabase
          .from("course_videos")
          .insert(videoData);

        if (error) throw error;
        toast.success("تم إضافة الفيديو بنجاح!");
      }

      setShowVideoModal(false);
      setEditingVideo(null);
      setVideoTitle("");
      setVideoDescription("");
      setVideoUrl("");
      setVideoLanguage("ar");
      setVideoDuration("");
      fetchCourseData();
    } catch (error) {
      console.error("Error saving video:", error);
      toast.error("حدث خطأ في حفظ الفيديو");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الفيديو؟")) return;

    try {
      const { error } = await supabase
        .from("course_videos")
        .delete()
        .eq("id", videoId);

      if (error) throw error;

      toast.success("تم حذف الفيديو بنجاح!");
      fetchCourseData();
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("حدث خطأ في حذف الفيديو");
    }
  };

  const openVideoModal = (video?: CourseVideo) => {
    if (video) {
      setEditingVideo(video);
      setVideoTitle(video.title);
      setVideoDescription(video.description || "");
      setVideoUrl(video.video_url);
      setVideoLanguage(video.language);
      setVideoDuration(video.duration ? video.duration.toString() : "");
    } else {
      setEditingVideo(null);
      setVideoTitle("");
      setVideoDescription("");
      setVideoUrl("");
      setVideoLanguage("ar");
      setVideoDuration("");
    }
    setShowVideoModal(true);
  };

  // File management functions
  const handleSaveFile = async () => {
    if (!course || !fileTitle.trim() || (!selectedFile && !editingFile)) return;

    try {
      setSubmitting(true);

      let fileUrl = editingFile?.file_url || "";

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${course.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("course-materials")
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;
        fileUrl = uploadData.path;
      }

      const fileData = {
        course_id: course.id,
        title: fileTitle.trim(),
        description: fileDescription.trim() || null,
        file_url: fileUrl,
        file_type: selectedFile?.type || editingFile?.file_type || "",
        file_size: selectedFile?.size || editingFile?.file_size || null,
        order_index: editingFile ? editingFile.order_index : files.length,
      };

      if (editingFile) {
        const { error } = await supabase
          .from("course_files")
          .update(fileData)
          .eq("id", editingFile.id);

        if (error) throw error;
        toast.success("تم تحديث الملف بنجاح!");
      } else {
        const { error } = await supabase.from("course_files").insert(fileData);

        if (error) throw error;
        toast.success("تم إضافة الملف بنجاح!");
      }

      setShowFileModal(false);
      setEditingFile(null);
      setFileTitle("");
      setFileDescription("");
      setSelectedFile(null);
      fetchCourseData();
    } catch (error) {
      console.error("Error saving file:", error);
      toast.error("حدث خطأ في حفظ الملف");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الملف؟")) return;

    try {
      const { error } = await supabase
        .from("course_files")
        .delete()
        .eq("id", fileId);

      if (error) throw error;

      toast.success("تم حذف الملف بنجاح!");
      fetchCourseData();
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("حدث خطأ في حذف الملف");
    }
  };

  const openFileModal = (file?: CourseFile) => {
    if (file) {
      setEditingFile(file);
      setFileTitle(file.title);
      setFileDescription(file.description || "");
      setSelectedFile(null);
    } else {
      setEditingFile(null);
      setFileTitle("");
      setFileDescription("");
      setSelectedFile(null);
    }
    setShowFileModal(true);
  };

  const getEnrollmentStatus = () => {
    if (!user) return "not_enrolled";
    if (!enrollment) return "not_enrolled";
    return enrollment.status;
  };

  const renderStatusBadge = () => {
    const status = getEnrollmentStatus();

    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 ml-1" />
            نشط
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 ml-1" />
            في الانتظار
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 ml-1" />
            مرفوض
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderActionButton = () => {
    const status = getEnrollmentStatus();

    if (!user) {
      return (
        <Button onClick={() => router.push("/login")} className="w-full">
          تسجيل الدخول للتسجيل
        </Button>
      );
    }

    switch (status) {
      case "active":
        return (
          <div className="space-y-3">
            <Button
              onClick={() => router.push("/ai-assistant")}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <MessageSquare className="w-4 h-4 ml-2" />
              بدء المساعد الذكي
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
            <p className="text-yellow-600 text-sm mt-1">
              سيتم الرد عليك خلال 24-48 ساعة
            </p>
          </div>
        );
      case "rejected":
        return (
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-red-800 font-medium">تم رفض طلب التسجيل</p>
            <p className="text-red-600 text-sm mt-1">
              يرجى مراجعة إثبات الدفع والمحاولة مرة أخرى
            </p>
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
            <Upload className="w-4 h-4 ml-2" />
            التسجيل في الكورس
          </Button>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            الكورس غير موجود
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            الكورس المطلوب غير متاح أو تم إلغاؤه.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Course Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{course.title}</CardTitle>
              <CardDescription className="text-lg">
                مدرب: {course.instructor_name}
              </CardDescription>
            </div>
            {renderStatusBadge()}
          </div>
          {course.price > 0 && (
            <div className="text-2xl font-bold text-green-600">
              {course.price} جنيه مصري
            </div>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            {course.description}
          </p>
          {renderActionButton()}
        </CardContent>
      </Card>

      {/* Course Content - Only for active enrollments */}
      {getEnrollmentStatus() === "active" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Unlock className="w-5 h-5 ml-2 text-green-600" />
              محتوى الكورس
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Unlock className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                تم تفعيل الكورس!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                يمكنك الآن الوصول لجميع محتويات الكورس والمساعد الذكي.
              </p>
              <Button onClick={() => router.push("/ai-assistant")} size="lg">
                <MessageSquare className="w-5 h-5 ml-2" />
                بدء المساعد الذكي
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Course Content Sections */}
      <React.Fragment>
        {/* Summaries Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="w-5 h-5 ml-2 text-blue-600" />
                ملخصات الكورس
              </div>
              {isInstructor() && (
                <Button
                  size="sm"
                  onClick={() => openSummaryModal()}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة ملخص
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getEnrollmentStatus() !== "active" ? (
              <div className="text-center py-8">
                <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  محتوى الملخصات متاح فقط للطلاب المسجلين في الكورس
                </p>
                {user ? (
                  getEnrollmentStatus() === "pending" ? (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      <Clock className="w-3 h-3 ml-1" />
                      طلب التسجيل قيد المراجعة
                    </Badge>
                  ) : (
                    <Button onClick={() => setShowSubscribeModal(true)}>
                      التسجيل في الكورس
                    </Button>
                  )
                ) : (
                  <p className="text-sm text-gray-500">
                    يرجى تسجيل الدخول أولاً للتسجيل في الكورس
                  </p>
                )}
              </div>
            ) : summaries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                لا توجد ملخصات متاحة لهذا الكورس بعد
              </p>
            ) : (
              <div className="space-y-4">
                {summaries.map((summary) => (
                  <div
                    key={summary.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {summary.title}
                      </h4>
                      {isInstructor() && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSummaryModal(summary)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteSummary(summary.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div
                      className="text-gray-700 dark:text-gray-300 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: summary.content }}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Videos Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Video className="w-5 h-5 ml-2 text-red-600" />
                فيدوهات الكورس
              </div>
              {isInstructor() && (
                <Button
                  size="sm"
                  onClick={() => openVideoModal()}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة فيديو
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getEnrollmentStatus() !== "active" ? (
              <div className="text-center py-8">
                <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  محتوى الفيديوهات متاح فقط للطلاب المسجلين في الكورس
                </p>
                {user ? (
                  getEnrollmentStatus() === "pending" ? (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      <Clock className="w-3 h-3 ml-1" />
                      طلب التسجيل قيد المراجعة
                    </Badge>
                  ) : (
                    <Button onClick={() => setShowSubscribeModal(true)}>
                      التسجيل في الكورس
                    </Button>
                  )
                ) : (
                  <p className="text-sm text-gray-500">
                    يرجى تسجيل الدخول أولاً للتسجيل في الكورس
                  </p>
                )}
              </div>
            ) : videos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                لا توجد فيدوهات متاحة لهذا الكورس بعد
              </p>
            ) : (
              <div className="space-y-6">
                {/* Arabic Videos */}
                {videos.filter((v) => v.language === "ar").length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm ml-2">
                        عربي
                      </span>
                      الفيدوهات العربية
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {videos
                        .filter((v) => v.language === "ar")
                        .map((video) => (
                          <div
                            key={video.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start space-x-3 rtl:space-x-reverse">
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                                  <Play className="w-6 h-6 text-red-600" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {video.title}
                                  </h5>
                                  {isInstructor() && (
                                    <div className="flex gap-1 ml-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openVideoModal(video)}
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          handleDeleteVideo(video.id)
                                        }
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {video.description && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                    {video.description}
                                  </p>
                                )}
                                {video.duration && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    المدة: {Math.floor(video.duration / 60)}:
                                    {(video.duration % 60)
                                      .toString()
                                      .padStart(2, "0")}
                                  </p>
                                )}
                                <Button
                                  size="sm"
                                  className="mt-2"
                                  onClick={() =>
                                    window.open(video.video_url, "_blank")
                                  }
                                >
                                  <Play className="w-4 h-4 ml-1" />
                                  مشاهدة
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* English Videos */}
                {videos.filter((v) => v.language === "en").length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm ml-2">
                        English
                      </span>
                      الفيدوهات الإنجليزية
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {videos
                        .filter((v) => v.language === "en")
                        .map((video) => (
                          <div
                            key={video.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start space-x-3 rtl:space-x-reverse">
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                                  <Play className="w-6 h-6 text-red-600" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {video.title}
                                  </h5>
                                  {isInstructor() && (
                                    <div className="flex gap-1 ml-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openVideoModal(video)}
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          handleDeleteVideo(video.id)
                                        }
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                {video.description && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                    {video.description}
                                  </p>
                                )}
                                {video.duration && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Duration: {Math.floor(video.duration / 60)}:
                                    {(video.duration % 60)
                                      .toString()
                                      .padStart(2, "0")}
                                  </p>
                                )}
                                <Button
                                  size="sm"
                                  className="mt-2"
                                  onClick={() =>
                                    window.open(video.video_url, "_blank")
                                  }
                                >
                                  <Play className="w-4 h-4 ml-1" />
                                  Watch
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Files Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Download className="w-5 h-5 ml-2 text-green-600" />
                ملفات الكورس
              </div>
              {isInstructor() && (
                <Button
                  size="sm"
                  onClick={() => openFileModal()}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة ملف
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getEnrollmentStatus() !== "active" ? (
              <div className="text-center py-8">
                <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  محتوى الملفات متاح فقط للطلاب المسجلين في الكورس
                </p>
                {user ? (
                  getEnrollmentStatus() === "pending" ? (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      <Clock className="w-3 h-3 ml-1" />
                      طلب التسجيل قيد المراجعة
                    </Badge>
                  ) : (
                    <Button onClick={() => setShowSubscribeModal(true)}>
                      التسجيل في الكورس
                    </Button>
                  )
                ) : (
                  <p className="text-sm text-gray-500">
                    يرجى تسجيل الدخول أولاً للتسجيل في الكورس
                  </p>
                )}
              </div>
            ) : files.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                لا توجد ملفات متاحة لهذا الكورس بعد
              </p>
            ) : (
              <div className="space-y-3">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {file.title}
                            </h5>
                            {file.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {file.description}
                              </p>
                            )}
                            {file.file_size && (
                              <p className="text-xs text-gray-400 mt-1">
                                حجم الملف:{" "}
                                {(file.file_size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            )}
                          </div>
                          {isInstructor() && (
                            <div className="flex gap-1 ml-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openFileModal(file)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteFile(file.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(file.file_url, "_blank")}
                    >
                      <Download className="w-4 h-4 ml-1" />
                      تحميل
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reviews Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>تقييمات الطلاب</span>
              {getEnrollmentStatus() === "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReviewForm(true)}
                >
                  <Star className="w-4 h-4 ml-1" />
                  أضف تقييم
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                لا توجد تقييمات بعد. كن أول من يقيم هذا الكورس!
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? "text-yellow-400 fill-current"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
                          {review.student_name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(review.created_at).toLocaleDateString(
                          "ar-EG",
                        )}
                      </span>
                    </div>
                    {review.content && (
                      <p className="text-gray-700 dark:text-gray-300">
                        {review.content}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscribe Modal */}
        {showSubscribeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>التسجيل في الكورس</CardTitle>
                <CardDescription>
                  يرجى رفع إثبات دفع للكورس ({course.price} جنيه مصري)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    إثبات الدفع (صورة أو لقطة شاشة)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setPaymentScreenshot(e.target.files?.[0] || null)
                    }
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    طرق الدفع المتاحة:
                  </h4>
                  <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <p>
                      <strong>InstaPay:</strong>{" "}
                      <span className="text-brand-orange font-semibold">
                        Doctor_payment@instapay
                      </span>
                    </p>
                    <p>
                      <strong>Vodafone Cash:</strong>{" "}
                      <span className="text-brand-orange font-semibold">
                        0101XXXXXXX
                      </span>
                    </p>
                    <p>
                      <strong>Another Number:</strong>{" "}
                      <span className="text-brand-orange font-semibold">
                        011XXXXXXXXX
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSubscribe}
                    disabled={!paymentScreenshot || uploadingScreenshot}
                    className="flex-1"
                  >
                    {uploadingScreenshot ? "جاري الرفع..." : "إرسال الطلب"}
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

        {/* Summary Modal */}
        {showSummaryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>
                  {editingSummary ? "تعديل الملخص" : "إضافة ملخص جديد"}
                </CardTitle>
                <CardDescription>أدخل تفاصيل الملخص</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    عنوان الملخص *
                  </label>
                  <input
                    type="text"
                    value={summaryTitle}
                    onChange={(e) => setSummaryTitle(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                    placeholder="أدخل عنوان الملخص"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    محتوى الملخص *
                  </label>
                  <Textarea
                    value={summaryContent}
                    onChange={(e) => setSummaryContent(e.target.value)}
                    placeholder="أدخل محتوى الملخص (يمكن استخدام HTML للتنسيق)"
                    rows={10}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveSummary}
                    disabled={
                      submitting ||
                      !summaryTitle.trim() ||
                      !summaryContent.trim()
                    }
                    className="flex-1"
                  >
                    {submitting
                      ? "جاري الحفظ..."
                      : editingSummary
                        ? "تحديث"
                        : "إضافة"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSummaryModal(false)}
                    className="flex-1"
                  >
                    إلغاء
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Video Modal */}
        {showVideoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>
                  {editingVideo ? "تعديل الفيديو" : "إضافة فيديو جديد"}
                </CardTitle>
                <CardDescription>أدخل تفاصيل الفيديو</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    عنوان الفيديو *
                  </label>
                  <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                    placeholder="أدخل عنوان الفيديو"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    وصف الفيديو
                  </label>
                  <Textarea
                    value={videoDescription}
                    onChange={(e) => setVideoDescription(e.target.value)}
                    placeholder="أدخل وصف الفيديو (اختياري)"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    رابط الفيديو *
                  </label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                    placeholder="أدخل رابط الفيديو (YouTube, Vimeo, إلخ)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      اللغة *
                    </label>
                    <select
                      value={videoLanguage}
                      onChange={(e) =>
                        setVideoLanguage(e.target.value as "ar" | "en")
                      }
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="ar">عربي</option>
                      <option value="en">إنجليزي</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      المدة (بالثواني)
                    </label>
                    <input
                      type="number"
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(e.target.value)}
                      className="w-full p-2 border rounded-lg"
                      placeholder="مثال: 3600"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveVideo}
                    disabled={
                      submitting || !videoTitle.trim() || !videoUrl.trim()
                    }
                    className="flex-1"
                  >
                    {submitting
                      ? "جاري الحفظ..."
                      : editingVideo
                        ? "تحديث"
                        : "إضافة"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowVideoModal(false)}
                    className="flex-1"
                  >
                    إلغاء
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* File Modal */}
        {showFileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>
                  {editingFile ? "تعديل الملف" : "إضافة ملف جديد"}
                </CardTitle>
                <CardDescription>أدخل تفاصيل الملف</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    عنوان الملف *
                  </label>
                  <input
                    type="text"
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                    placeholder="أدخل عنوان الملف"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    وصف الملف
                  </label>
                  <Textarea
                    value={fileDescription}
                    onChange={(e) => setFileDescription(e.target.value)}
                    placeholder="أدخل وصف الملف (اختياري)"
                    rows={3}
                  />
                </div>

                {!editingFile && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      اختر الملف *
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar"
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] || null)
                      }
                      className="w-full p-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      الصيغ المدعومة: PDF, Word, PowerPoint, Excel, Text, ZIP
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveFile}
                    disabled={
                      submitting ||
                      !fileTitle.trim() ||
                      (!selectedFile && !editingFile)
                    }
                    className="flex-1"
                  >
                    {submitting
                      ? "جاري الحفظ..."
                      : editingFile
                        ? "تحديث"
                        : "إضافة"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowFileModal(false)}
                    className="flex-1"
                  >
                    إلغاء
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Review Modal */}
        {showReviewForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>تقييم الكورس</CardTitle>
                <CardDescription>
                  شاركنا رأيك في الكورس لمساعدة الطلاب الآخرين
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    التقييم
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= reviewRating
                              ? "text-yellow-400 fill-current"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    التعليق (اختياري)
                  </label>
                  <Textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="شاركنا تجربتك مع الكورس..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSubmitReview}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? "جاري الإرسال..." : "إرسال التقييم"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowReviewForm(false)}
                    className="flex-1"
                  >
                    إلغاء
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </React.Fragment>
    </div>
  );
}
