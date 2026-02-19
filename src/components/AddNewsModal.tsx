import { useMemo, useState } from "react";
import { X, Upload } from "lucide-react";
import Image from "next/image";
import { Database } from "../types/database";
import { uploadToCloudinary } from "../lib/cloudinary";
import { FileDropzone } from "./FileDropzone";
import { useAcademicOptions } from "../hooks/useAcademicOptions";
import { useAuth } from "../contexts/AuthContext";
import { useSubjects } from "../hooks/useSubjects";

interface AddNewsModalProps {
  showAddNews: boolean;
  newNews: Database["public"]["Tables"]["news"]["Insert"];
  onSetShowAddNews: (show: boolean) => void;
  onSetNewNews: (news: Database["public"]["Tables"]["news"]["Insert"]) => void;
  onAddNews: (
    news: Database["public"]["Tables"]["news"]["Insert"],
    fileUrl: string | null,
    imageUrls: string[] | null,
    customCategory: string | null,
  ) => void;
}

export function AddNewsModal({
  showAddNews,
  newNews,
  onSetShowAddNews,
  onSetNewNews,
  onAddNews,
}: AddNewsModalProps) {
  const { user } = useAuth();
  const [semester, setSemester] = useState<number>(1);
  const { levels, getDepartmentsForLevelName } = useAcademicOptions({
    includeInactive: true,
  });

  const selectedLevelNumber = useMemo(() => {
    if (!newNews.year) return undefined;
    const found = levels.find((l) => l.name === newNews.year);
    return typeof found?.level_number === "number"
      ? found.level_number
      : undefined;
  }, [levels, newNews.year]);

  const { subjects, loading: subjectsLoading } = useSubjects({
    level: selectedLevelNumber,
    semester: newNews.year ? semester : undefined,
  });
  const [fileFile, setFileFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [customCategory, setCustomCategory] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const availableDepartments = useMemo(() => {
    if (!newNews.year) return [];
    return getDepartmentsForLevelName(newNews.year);
  }, [newNews.year, getDepartmentsForLevelName]);

  if (!showAddNews) return null;

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddNews = async () => {
    // Check authentication first
    if (!user) {
      setError("يجب تسجيل الدخول أولاً لإضافة الأخبار");
      return;
    }

    setLoading(true);
    setError("");
    let fileUrl: string | null = null;
    const imageUrls: string[] = [];

    try {
      if (fileFile) {
        const result = await uploadToCloudinary(fileFile, {
          folder: "masarx-news-files",
        });
        fileUrl = result.url;
      }

      if (imageFiles.length > 0) {
        for (const imageFile of imageFiles) {
          const result = await uploadToCloudinary(imageFile, {
            folder: "masarx-news-images",
          });
          imageUrls.push(result.url);
        }
      }

      const finalNewsData = {
        ...newNews,
        type:
          (newNews.type as any) === "custom"
            ? "announcement"
            : (newNews.type as "announcement" | "update" | "important"),
      };

      onAddNews(finalNewsData, fileUrl, imageUrls, customCategory);
      setFileFile(null);
      setImageFiles([]);
      setCustomCategory("");
    } catch {
      // ignore
    } finally {
      setError("حدث خطأ أثناء رفع الملفات. يرجى المحاولة مرة أخرى.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            إضافة خبر جديد
          </h2>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                العنوان
              </label>
              <input
                type="text"
                value={newNews.title}
                onChange={(e) =>
                  onSetNewNews({ ...newNews, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="أدخل عنوان الخبر"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                النوع
              </label>
              <select
                value={newNews.type}
                onChange={(e) =>
                  onSetNewNews({
                    ...newNews,
                    type: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="announcement">إعلان</option>
                <option value="update">تحديث</option>
                <option value="important">مهم</option>
                <option value="custom">مخصص</option>
              </select>
            </div>

            {(newNews.type as any) === "custom" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  التصنيف المخصص ( جدول مادة ****)
                </label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="أدخل تصنيف مخصص للخبر (اختياري)"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                المحتوى
              </label>
              <textarea
                value={newNews.content}
                onChange={(e) =>
                  onSetNewNews({ ...newNews, content: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-h-[100px]"
                placeholder="أدخل محتوى الخبر"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المستوى (اختياري)
                </label>
                <select
                  value={newNews.year || ""}
                  onChange={(e) =>
                    onSetNewNews({
                      ...newNews,
                      year: e.target.value || null,
                      department: null,
                      subject: null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">كل المستويات</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.name}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  الترم (اختياري)
                </label>
                <select
                  value={semester}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setSemester(next);
                    onSetNewNews({
                      ...newNews,
                      department: null,
                      subject: null,
                    });
                  }}
                  disabled={!newNews.year}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60"
                >
                  <option value={1}>ترم 1</option>
                  <option value={2}>ترم 2</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  القسم (اختياري)
                </label>
                <select
                  value={newNews.department || ""}
                  onChange={(e) =>
                    onSetNewNews({
                      ...newNews,
                      department: e.target.value || null,
                      subject: null,
                    })
                  }
                  disabled={!newNews.year || availableDepartments.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">كل الأقسام</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  المادة (اختياري)
                </label>
                <select
                  value={newNews.subject || ""}
                  onChange={(e) =>
                    onSetNewNews({
                      ...newNews,
                      subject: e.target.value || null,
                    })
                  }
                  disabled={subjectsLoading}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-60"
                >
                  <option value="">
                    {subjectsLoading ? "جاري تحميل المواد..." : "كل المواد"}
                  </option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                رفع ملف (PDF أو Word) (اختياري)
              </label>
              <FileDropzone
                onFileSelect={(files) => {
                  if (files.length > 0) {
                    const file = files[0];
                    if (
                      file &&
                      (file.type === "application/pdf" ||
                        file.type === "application/msword" ||
                        file.type ===
                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                    ) {
                      setFileFile(file);
                      setError("");
                    } else {
                      setError("يرجى اختيار ملف PDF أو Word فقط");
                      setFileFile(null);
                    }
                  }
                }}
                accept=".pdf,.doc,.docx"
                className="w-full h-32"
              >
                <div className="flex flex-col items-center justify-center w-full h-full border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
                    {fileFile ? (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {fileFile.name}
                      </p>
                    ) : (
                      <>
                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-semibold">
                            اضغط أو اسحب لرفع ملف
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          PDF, Word (حتى 10MB)
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </FileDropzone>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الأولوية
              </label>
              <input
                type="number"
                value={newNews.priority}
                onChange={(e) =>
                  onSetNewNews({
                    ...newNews,
                    priority: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="أدخل الأولوية (0-10)"
                min="0"
                max="10"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleAddNews}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "جاري الإضافة..." : "إضافة الخبر"}
            </button>
            <button
              onClick={() => onSetShowAddNews(false)}
              className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 px-6 py-2 rounded-lg font-medium transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
