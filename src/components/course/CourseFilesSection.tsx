import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "../ui";
import { Download, FileText, Plus, Edit, Trash2 } from "lucide-react";
import type { CourseFile } from "./types";

interface CourseFilesSectionProps {
  files: CourseFile[];
  isInstructor: boolean;
  onAddFile: () => void;
  onEditFile: (file: CourseFile) => void;
  onDeleteFile: (fileId: string) => void;
}

export default function CourseFilesSection({
  files,
  isInstructor,
  onAddFile,
  onEditFile,
  onDeleteFile,
}: CourseFilesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Download className="w-5 h-5 ml-2 text-green-600" />
            ملفات الكورس
          </div>
          {isInstructor && (
            <Button
              size="sm"
              onClick={onAddFile}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة ملف
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
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
                            حجم الملف: {(file.file_size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>
                      {isInstructor && (
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEditFile(file)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onDeleteFile(file.id)}
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
  );
}
