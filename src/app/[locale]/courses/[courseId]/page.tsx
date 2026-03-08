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
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Textarea,
} from "@/components/ui";
import {
  Star,
  Upload,
  Lock,
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
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { confirmToast } from "@/lib/confirmToast";

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

  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

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
        const isInstructorUser = user && user.id === courseData.instructor_id;
        const isDoctorAdmin = adminRole === "doctor";
        if (!courseData.is_published && !isInstructorUser && !isDoctorAdmin) {
          throw new Error("Course is not published");
        }

        setCourse({
          ...courseData,
          instructor_name: courseData.profiles?.display_name || "مدرب",
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
            reviewsData.map((review: any) => ({
              ...review,
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
    } catch {
      toast.error("حدث خطأ في تحميل بيانات الكورس");
    } finally {
      setLoading(false);
    }
  }, [courseId, user, adminRole]);

  useEffect(() => {
    if (courseId) fetchCourseData();
  }, [courseId, fetchCourseData]);

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
      fetchCourseData();
    } catch {
      toast.error("حدث خطأ في إرسال التقييم");
    } finally {
      setSubmitting(false);
    }
  };

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
      fetchCourseData();
    } catch {
      toast.error("حدث خطأ في حفظ الملخص");
    } finally {
      setSubmitting(false);
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
      fetchCourseData();
    } catch {
      toast.error("حدث خطأ في حفظ الفيديو");
    } finally {
      setSubmitting(false);
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
      fetchCourseData();
    } catch {
      toast.error("حدث خطأ في حفظ الملف");
    } finally {
      setSubmitting(false);
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

  const openFileModal = (file?: CourseFile) => {
    if (file) {
      setEditingFile(file);
      setFileTitle(file.title);
      setFileDescription(file.description || "");
    } else {
      setEditingFile(null);
      setFileTitle("");
      setFileDescription("");
    }
    setShowFileModal(true);
  };

  const getEnrollmentStatus = () => {
    if (!user || !enrollment) return "not_enrolled";
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
            <Upload className="w-4 h-4 ml-2" />
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

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="w-5 h-5 ml-2 text-blue-600" />
                ملخصات الكورس
              </div>
              {isInstructor() && (
                <Button size="sm" onClick={() => openSummaryModal()}>
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
                <p className="text-gray-600 dark:text-gray-400">
                  محتوى الملخصات متاح فقط للطلاب المسجلين
                </p>
              </div>
            ) : summaries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                لا توجد ملخصات متاحة
              </p>
            ) : (
              <div className="space-y-4">
                {summaries.map((s) => (
                  <div
                    key={s.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-semibold">{s.title}</h4>
                      {isInstructor() && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSummaryModal(s)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteSummary(s.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 prose prose-sm max-w-none whitespace-pre-wrap">
                      {s.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Video className="w-5 h-5 ml-2 text-red-600" />
                فيدوهات الكورس
              </div>
              {isInstructor() && (
                <Button size="sm" onClick={() => openVideoModal()}>
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
                <p className="text-gray-600 dark:text-gray-400">
                  محتوى الفيديوهات متاح فقط للطلاب المسجلين
                </p>
              </div>
            ) : videos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                لا توجد فيدوهات متاحة
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start space-x-3 rtl:space-x-reverse">
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <Play className="w-6 h-6 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="text-sm font-medium truncate">
                            {v.title}
                          </h5>
                          {isInstructor() && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openVideoModal(v)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteVideo(v.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="link"
                          className="p-0 h-auto text-blue-600"
                          onClick={() => window.open(v.video_url, "_blank")}
                        >
                          مشاهدة الآن
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Download className="w-5 h-5 ml-2 text-green-600" />
                ملفات الكورس
              </div>
              {isInstructor() && (
                <Button size="sm" onClick={() => openFileModal()}>
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
                <p className="text-gray-600 dark:text-gray-400">
                  محتوى الملفات متاح فقط للطلاب المسجلين
                </p>
              </div>
            ) : files.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                لا توجد ملفات متاحة
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                        <Download className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h5 className="text-sm font-medium truncate">
                            {f.title}
                          </h5>
                          {isInstructor() && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openFileModal(f)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteFile(f.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="link"
                          className="p-0 h-auto text-blue-600"
                          onClick={() => {
                            const { data } = supabase.storage
                              .from("course-materials")
                              .getPublicUrl(f.file_url);
                            window.open(data.publicUrl, "_blank");
                          }}
                        >
                          تحميل
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Star className="w-5 h-5 ml-2 text-yellow-500" />
            التقييمات والآراء
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              لا توجد تقييمات بعد
            </p>
          ) : (
            <div className="space-y-6">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-6 last:pb-0"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{r.student_name}</div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${s <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.content && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {r.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

        {showSummaryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>
                  {editingSummary ? "تعديل الملخص" : "إضافة ملخص جديد"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="text"
                  value={summaryTitle}
                  onChange={(e) => setSummaryTitle(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  placeholder="العنوان"
                />
                <Textarea
                  value={summaryContent}
                  onChange={(e) => setSummaryContent(e.target.value)}
                  placeholder="المحتوى"
                  rows={10}
                />
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
                    {submitting ? "جاري الحفظ..." : "حفظ"}
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

        {showVideoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>
                  {editingVideo ? "تعديل الفيديو" : "إضافة فيديو جديد"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  placeholder="العنوان"
                />
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  placeholder="الرابط"
                />
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveVideo}
                    disabled={
                      submitting || !videoTitle.trim() || !videoUrl.trim()
                    }
                    className="flex-1"
                  >
                    {submitting ? "جاري الحفظ..." : "حفظ"}
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

        {showFileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>
                  {editingFile ? "تعديل الملف" : "إضافة ملف جديد"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="text"
                  value={fileTitle}
                  onChange={(e) => setFileTitle(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  placeholder="العنوان"
                />
                {!editingFile && (
                  <input
                    type="file"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                    className="w-full p-2 border rounded-lg"
                  />
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
                    {submitting ? "جاري الحفظ..." : "حفظ"}
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

        {showReviewForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>تقييم الكورس</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setReviewRating(star)}>
                      <Star
                        className={`w-8 h-8 ${star <= reviewRating ? "text-yellow-400 fill-current" : "text-gray-300"}`}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="رأيك..."
                  rows={3}
                />
                <div className="flex gap-3">
                  <Button
                    onClick={handleSubmitReview}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? "جاري الإرسال..." : "إرسال"}
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
      </AnimatePresence>
    </motion.div>
  );
}
