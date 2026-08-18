
import { Upload } from "lucide-react";
import { FileDropzone } from "../FileDropzone";

interface AttachmentSectionProps {
  attachmentType: "file" | "link";
  setAttachmentType: (type: "file" | "link") => void;
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  driveLink: string;
  setDriveLink: (link: string) => void;
  setError: (error: string) => void;
}

export function AttachmentSection({
  attachmentType,
  setAttachmentType,
  pdfFile,
  setPdfFile,
  driveLink,
  setDriveLink,
  setError,
}: AttachmentSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        تحديث المرفقات (اختياري)
      </label>

      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">
          اختر نوع المرفق:
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              id="attachment-type-file"
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
          <label className="flex items-center cursor-pointer">
            <input
              id="attachment-type-link"
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
      </div>

      {attachmentType === "file" && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            تحديث ملف PDF
          </label>
          <FileDropzone
            onFileSelect={(files: File[]) => {
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
                      <span className="font-semibold">اضغط لتحديث ملف PDF</span>
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
          <label 
            htmlFor="drive-link"
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2"
          >
            رابط Google Drive
          </label>
          <input
            id="drive-link"
            name="driveLink"
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
  );
}
