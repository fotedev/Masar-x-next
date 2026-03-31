
import { Upload, X } from "lucide-react";
import Image from "next/image";
import { FileDropzone } from "../FileDropzone";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface NewsMediaUploadsProps {
  fileFile: File | null;
  setFileFile: (file: File | null) => void;
  imageFiles: File[];
  setImageFiles: (files: File[] | ((prev: File[]) => File[])) => void;
  setError: (err: string) => void;
  t: TranslationFn;
}

export function NewsMediaUploads({
  fileFile,
  setFileFile,
  imageFiles,
  setImageFiles,
  setError,
  t,
}: NewsMediaUploadsProps) {
  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("newsFile")}
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
                setError(t("newsFileError"));
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
                    <span className="font-semibold">{t("newsFileDrop")}</span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {t("newsFileSize")}
                  </p>
                </>
              )}
            </div>
          </div>
        </FileDropzone>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("newsImages")}
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
              setError(t("newsImagesError"));
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
                <span className="font-semibold">{t("newsImagesDrop")}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {t("newsImagesSize")}
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
    </div>
  );
}
