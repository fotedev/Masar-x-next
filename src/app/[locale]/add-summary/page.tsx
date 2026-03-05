"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Upload, Send, CheckCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications as useBrowserNotifications } from "@/components/NotificationManager";
import { useNotifications as useDbNotifications } from "@/hooks/useNotifications";
import { useSubjects } from "@/hooks/useSubjects";
import type { SummaryInsert } from "@/types/database";
import { FileDropzone } from "@/components/FileDropzone";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";

export default function AddSummaryPage() {
  const router = useRouter();
  const [lectureKeyFromQuery, setLectureKeyFromQuery] = useState("");
  const { user, displayName } = useAuth();
  const { sendNotification } = useBrowserNotifications();
  const { notifyAdmins } = useDbNotifications();
  const { levels, getDepartmentsForLevelName, optionsLoading } =
    useAcademicOptions();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLectureKeyFromQuery((params.get("lecture") || "").trim());
  }, []);
  const [semester, setSemester] = useState<number>(1);

  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    year: "",
    department: "",
    content: "",
    youtube_url: "",
  });

  const selectedLevelNumber = useMemo(() => {
    if (!formData.year) return null;
    const found = levels.find((l) => l.name === formData.year);
    return typeof found?.level_number === "number" ? found.level_number : null;
  }, [formData.year, levels]);

  const { subjects } = useSubjects({
    level: selectedLevelNumber,
    semester: typeof semester === "number" ? semester : null,
  });

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [uploadStage, setUploadStage] = useState<string>("");
  const [attachmentType, setAttachmentType] = useState<"file" | "link">("file");
  const [driveLink, setDriveLink] = useState<string>("");
  const [youtubeLink, setYoutubeLink] = useState<string>("");

  const availableDepartments = useMemo(() => {
    if (!formData.year) return [];
    return getDepartmentsForLevelName(formData.year);
  }, [formData.year, getDepartmentsForLevelName]);

  useEffect(() => {
    if (!formData.year) {
      if (formData.department) {
        setFormData((prev) => ({ ...prev, department: "" }));
      }
      return;
    }

    if (formData.department) {
      const exists = availableDepartments.some(
        (d) => d.name === formData.department,
      );
      if (!exists) {
        setFormData((prev) => ({ ...prev, department: "" }));
      }
    }
  }, [availableDepartments, formData.department, formData.year]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUploadProgress({});
    setUploadStage("");

    try {
      if (!user?.id) {
        setError("يجب تسجيل الدخول لإرسال الملخص");
        setLoading(false);
        return;
      }

      // Check PDF file size (10MB limit)
      if (attachmentType === "file" && pdfFile) {
        const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
        if (pdfFile.size > MAX_PDF_SIZE) {
          setError("حجم ملف PDF يتجاوز الحد المسموح به (10MB)");
          setLoading(false);
          return;
        }
      }

      // Check Image file sizes (5MB limit per image)
      if (imageFiles.length > 0) {
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
        const oversizedImage = imageFiles.find(
          (file) => file.size > MAX_IMAGE_SIZE,
        );
        if (oversizedImage) {
          setError(
            `حجم الصورة "${oversizedImage.name}" يتجاوز الحد المسموح به (5MB)`,
          );
          setLoading(false);
          return;
        }
      }

      let lectureId: string | null = null;
      if (lectureKeyFromQuery) {
        const { data: lectureRow, error: lectureError } = await supabase
          .from("subject_lectures")
          .select("id,lecture_key")
          .eq("subject", formData.subject)
          .eq("lecture_key", lectureKeyFromQuery)
          .maybeSingle();

        if (lectureError) throw lectureError;
        if (!lectureRow) {
          setError("المحاضرة المحددة غير صالحة لهذه المادة");
          setLoading(false);
          return;
        }

        lectureId = lectureRow.id || null;
      }

      // Validate attachment data
      if (attachmentType === "link" && driveLink.trim()) {
        // Strict Google Drive validation
        const isGoogleDrive =
          /^(https?:\/\/)?(www\.)?(drive|docs)\.google\.com\/.+/.test(
            driveLink.trim(),
          );
        if (!isGoogleDrive) {
          setError(
            "يرجى إدخال رابط Google Drive صحيح (https://drive.google.com/...)",
          );
          setLoading(false);
          return;
        }
      } else if (attachmentType === "link" && !driveLink.trim()) {
        setError("يرجى إدخال رابط Google Drive أو اختر رفع ملف");
        setLoading(false);
        return;
      }

      // Validate YouTube link if provided
      if (youtubeLink.trim()) {
        const youtubeRegex =
          /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|.+\?v=)?([^&=%\?]{11})/;
        if (!youtubeRegex.test(youtubeLink.trim())) {
          setError("يرجى إدخال رابط يوتيوب صحيح");
          setLoading(false);
          return;
        }
      }

      let cloudinaryResult = null;
      const uploadedImageUrls: string[] = [];

      if (attachmentType === "file" && pdfFile) {
        // رفع الملف إلى Cloudinary مع البيانات الوصفية
        setUploadStage("جاري رفع ملف PDF...");
        cloudinaryResult = await uploadToCloudinary(pdfFile, {
          folder: "masarx-summaries",
          onProgress: (progress, stage) => {
            setUploadProgress((prev) => ({ ...prev, pdf: progress }));
            setUploadStage(stage);
          },
        });
      }

      // رفع الصور إلى Cloudinary
      if (imageFiles.length > 0) {
        setUploadStage("جاري رفع الصور...");
        for (let i = 0; i < imageFiles.length; i++) {
          const imageFile = imageFiles[i];
          try {
            const imageResult = await uploadToCloudinary(imageFile, {
              folder: "masarx-summary-images",
              onProgress: (progress, stage) => {
                const overallProgress =
                  (i * 100 + progress) / imageFiles.length;
                setUploadProgress((prev) => ({
                  ...prev,
                  images: overallProgress,
                }));
                setUploadStage(
                  `رفع الصورة ${i + 1}/${imageFiles.length}: ${stage}`,
                );
              },
            });
            uploadedImageUrls.push(imageResult.url);
          } catch {
            // Continue with other images even if one fails
          }
        }
      }

      // إنشاء سجل الملخص في قاعدة البيانات
      const summaryData: SummaryInsert = {
        title: formData.title,
        subject: formData.subject,
        year: formData.year,
        department: formData.department,
        content:
          uploadedImageUrls.length > 0
            ? `${formData.content}\n\n[IMAGES:${JSON.stringify(
                uploadedImageUrls,
              )}]`
            : formData.content,
        contributor_name: displayName || null,
        pdf_url:
          attachmentType === "file"
            ? cloudinaryResult?.url || null
            : driveLink || null,
        youtube_url: youtubeLink.trim() || null,
        status: "pending",
        user_id: user?.id ?? null,
        lecture_key: lectureKeyFromQuery || null,
        lecture_id: lectureId,
      };

      const { data: insertedData, error: insertError } = await supabase
        .from("summaries")
        .insert(summaryData)
        .select()
        .single();

      if (insertError) throw insertError;

      // إرسال إشعار للمدراء
      notifyAdmins(
        "ملخص جديد يحتاج مراجعة",
        `تم إرسال ملخص "${formData.title}" بواسطة ${displayName || "مجهول"}`,
        "admin_submission",
        insertedData.id,
        "summary",
      );

      setSuccess(true);

      // إرسال إشعار نجاح الإضافة للمستخدم
      const notificationMessage = pdfFile
        ? `ملخص "${formData.title}" تم رفعه وسيتم مراجعته قريباً`
        : `ملخص "${formData.title}" تم إرساله وسيتم مراجعته قريباً`;

      sendNotification("تم إرسال الملخص بنجاح!", {
        body: notificationMessage,
        icon: "/logo.png",
        tag: "summary-submitted",
      });

      setFormData({
        title: "",
        subject: "",
        year: "",
        department: "",
        content: "",
        youtube_url: "",
      });
      setYoutubeLink("");
      setPdfFile(null);
      setImageFiles([]);
      setAttachmentType("file");
      setDriveLink("");
      setUploadProgress({});
      setUploadStage("");

      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      const message =
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : "حدث خطأ أثناء إرسال الملخص. يرجى المحاولة مرة أخرى.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 sm:p-8 text-center transition-colors">
          <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            تم إرسال الملخص بنجاح!
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
            سيتم مراجعة الملخص من قبل المشرفين ونشره قريباً
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-500">
            سيتم تحويلك إلى الصفحة الرئيسية...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6 lg:p-8 transition-colors">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
            إضافة ملخص جديد
          </h1>
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
          شارك ملخصك مع زملائك الطلاب
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label
              htmlFor="summary-title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              عنوان الملخص <span className="text-red-500">*</span>
            </label>
            <input
              id="summary-title"
              name="summaryTitle"
              type="text"
              required
              autoComplete="off"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
              placeholder="مثال: ملخص الفصل الأول - مقدمة في البرمجة"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="summary-year"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                المستوى الدراسي <span className="text-red-500">*</span>
              </label>
              <select
                id="summary-year"
                name="summaryYear"
                required
                autoComplete="off"
                value={formData.year}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: e.target.value,
                    department: "",
                    subject: "",
                  })
                }
                onBlur={() => {
                  if (!formData.year) return;
                  if (![1, 2].includes(semester)) setSemester(1);
                }}
                disabled={optionsLoading}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="">
                  {optionsLoading ? "جاري التحميل..." : "اختر المستوي"}
                </option>
                {!optionsLoading &&
                  levels.map((lvl) => (
                    <option key={lvl.id} value={lvl.name}>
                      {lvl.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="summary-semester"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                الترم <span className="text-red-500">*</span>
              </label>
              <select
                id="summary-semester"
                name="summarySemester"
                required
                autoComplete="off"
                value={semester}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setSemester(next);
                  setFormData((prev) => ({
                    ...prev,
                    department: "",
                    subject: "",
                  }));
                }}
                disabled={!formData.year}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
              >
                <option value={1}>ترم 1</option>
                <option value={2}>ترم 2</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="summary-department"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                التخصص <span className="text-red-500">*</span>
              </label>
              <select
                id="summary-department"
                name="summaryDepartment"
                value={formData.department}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                disabled={
                  optionsLoading ||
                  !formData.year ||
                  availableDepartments.length === 0
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="">
                  {optionsLoading ? "جاري التحميل..." : "اختر التخصص"}
                </option>
                {!optionsLoading &&
                  availableDepartments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="summary-subject"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              اسم المادة <span className="text-red-500">*</span>
            </label>
            <select
              id="summary-subject"
              name="summarySubject"
              required
              autoComplete="off"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">اختر المادة</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.name}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="summary-content"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              محتوى الملخص <span className="text-red-500">*</span>
            </label>
            <textarea
              id="summary-content"
              name="summaryContent"
              required
              autoComplete="off"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              rows={10}
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
              placeholder="اكتب محتوى الملخص هنا..."
            />
          </div>

          <div>
            <label
              htmlFor="summary-youtube"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              رابط يوتيوب (اختياري)
            </label>
            <input
              id="summary-youtube"
              type="url"
              value={youtubeLink}
              onChange={(e) => setYoutubeLink(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              المرفقات (اختياري)
            </label>

            <div className="flex gap-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="attachmentType"
                  value="file"
                  checked={attachmentType === "file"}
                  onChange={(e) => setAttachmentType(e.target.value as "file")}
                  className="ml-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">
                  رفع ملف PDF
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="attachmentType"
                  value="link"
                  checked={attachmentType === "link"}
                  onChange={(e) => setAttachmentType(e.target.value as "link")}
                  className="ml-2 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">
                  رابط Google Drive
                </span>
              </label>
            </div>

            {attachmentType === "file" && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  رفع ملف PDF
                </label>
                <FileDropzone
                  onFileSelect={(files) => {
                    if (files.length > 0) {
                      const file = files[0];
                      if (file && file.type === "application/pdf") {
                        setPdfFile(file);
                        setError("");
                      } else {
                        setError("يرجى اختيار ملف PDF فقط");
                        setPdfFile(null);
                      }
                    }
                  }}
                  accept=".pdf"
                  className="w-full h-32"
                >
                  <div className="flex flex-col items-center justify-center w-full h-full border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
                      {pdfFile ? (
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {pdfFile.name}
                        </p>
                      ) : (
                        <>
                          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-semibold">
                              اضغط أو اسحب لرفع ملف PDF
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            PDF فقط (حتى 10MB)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </FileDropzone>
              </div>
            )}

            {attachmentType === "link" && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  رابط Google Drive
                </label>
                <input
                  type="url"
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
                />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  تأكد من أن الرابط قابل للوصول للجميع (عام)
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              رفع صور (اختياري)
            </label>
            <FileDropzone
              onFileSelect={(files) => {
                const validImages = files.filter((file) => {
                  const validTypes = [
                    "image/jpeg",
                    "image/jpg",
                    "image/png",
                    "image/gif",
                    "image/webp",
                  ];
                  return validTypes.includes(file.type);
                });

                if (validImages.length !== files.length) {
                  setError(
                    "بعض الملفات المختارة ليست صور صالحة (JPEG, PNG, GIF, WebP فقط)",
                  );
                } else {
                  setError("");
                }

                setImageFiles((prev) => [...prev, ...validImages]);
              }}
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              multiple
              className="w-full h-32"
            >
              <div className="flex flex-col items-center justify-center w-full h-full border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">
                      اضغط أو اسحب لرفع الصور
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    JPEG, PNG, GIF, WebP (حتى 5MB لكل صورة)
                  </p>
                </div>
              </div>
            </FileDropzone>

            {imageFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {imageFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="w-full h-24 relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
                      <Image
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="إزالة الصورة"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {displayName && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>ملاحظة:</strong> الملخص سيُنشر باسم:{" "}
                <strong>{displayName}</strong>
              </p>
            </div>
          )}

          {loading && uploadStage && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  {uploadStage}
                </span>
                {Object.values(uploadProgress).some((p) => p > 0) && (
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {Math.round(
                      Object.values(uploadProgress).reduce(
                        (a, b) => Math.max(a, b),
                        0,
                      ),
                    )}
                    %
                  </span>
                )}
              </div>
              {Object.values(uploadProgress).some((p) => p > 0) && (
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Object.values(uploadProgress).reduce(
                        (a, b) => Math.max(a, b),
                        0,
                      )}%`,
                    }}
                  ></div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 sm:px-6 py-3 sm:py-3 rounded-lg font-medium focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base touch-manipulation"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>جاري الإرسال...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>إرسال الملخص</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
