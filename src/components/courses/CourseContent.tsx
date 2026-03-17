import React from "react";
import {
  Lock,
  FileText,
  Plus,
  Edit,
  Trash2,
  Video,
  Play,
  Download,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";

type CourseSummary = {
  id: string;
  title: string;
  content: string;
  order_index: number;
  created_at: string;
};

type CourseVideo = {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  language: "ar" | "en";
  duration?: number;
  order_index: number;
  created_at: string;
};

type CourseFile = {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  file_type: string;
  file_size?: number;
  order_index: number;
  created_at: string;
};

interface CourseContentProps {
  enrollmentStatus: string;
  isInstructor: boolean;
  summaries: CourseSummary[];
  videos: CourseVideo[];
  files: CourseFile[];
  onOpenSummaryModal: (summary?: CourseSummary) => void;
  onDeleteSummary: (id: string) => void;
  onOpenVideoModal: (video?: CourseVideo) => void;
  onDeleteVideo: (id: string) => void;
  onOpenFileModal: (file?: CourseFile) => void;
  onDeleteFile: (id: string) => void;
  onDownloadFile: (fileUrl: string) => void;
}

export function CourseContent({
  enrollmentStatus,
  isInstructor,
  summaries,
  videos,
  files,
  onOpenSummaryModal,
  onDeleteSummary,
  onOpenVideoModal,
  onDeleteVideo,
  onOpenFileModal,
  onDeleteFile,
  onDownloadFile,
}: CourseContentProps) {
  const isEnrolled = enrollmentStatus === "active";

  return (
    <div className="space-y-6">
      {/* Summaries Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="w-5 h-5 ml-2 text-blue-600" />
              ملخصات الكورس
            </div>
            {isInstructor && (
              <Button size="sm" onClick={() => onOpenSummaryModal()}>
                <Plus className="w-4 h-4" />
                إضافة ملخص
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isEnrolled ? (
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
                    {isInstructor && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenSummaryModal(s)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDeleteSummary(s.id)}
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

      {/* Videos Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Video className="w-5 h-5 ml-2 text-red-600" />
              فيدوهات الكورس
            </div>
            {isInstructor && (
              <Button size="sm" onClick={() => onOpenVideoModal()}>
                <Plus className="w-4 h-4" />
                إضافة فيديو
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isEnrolled ? (
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
                        {isInstructor && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenVideoModal(v)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onDeleteVideo(v.id)}
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

      {/* Files Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Download className="w-5 h-5 ml-2 text-green-600" />
              ملفات الكورس
            </div>
            {isInstructor && (
              <Button size="sm" onClick={() => onOpenFileModal()}>
                <Plus className="w-4 h-4" />
                إضافة ملف
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isEnrolled ? (
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
                        {isInstructor && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenFileModal(f)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onDeleteFile(f.id)}
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
                        onClick={() => onDownloadFile(f.file_url)}
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
  );
}
