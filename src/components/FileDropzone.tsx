import React, { useCallback, useState } from "react";
import { Upload } from "lucide-react";

interface FileDropzoneProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function FileDropzone({
  onFileSelect,
  accept,
  multiple = false,
  children,
  className = "",
  disabled = false,
}: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled],
  );

  const validateAndPassFiles = useCallback(
    (files: File[]) => {
      if (!accept) {
        onFileSelect(files);
        return;
      }

      // Basic client-side validation for accept attribute if needed
      // For now, we rely on the input's accept attribute and manual checks in parent
      // but we could implement mime-type checking here if desired.
      // The parent component is usually responsible for strict validation (size, type).
      onFileSelect(files);
    },
    [accept, onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        validateAndPassFiles(files);
      }
    },
    [disabled, validateAndPassFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        validateAndPassFiles(files);
      }
      // Reset input value to allow selecting the same file again
      e.target.value = "";
    },
    [validateAndPassFiles],
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative ${className}`}
    >
      <label
        className={`cursor-pointer block w-full h-full transition-colors ${
          isDragActive
            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400"
            : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept}
          onChange={handleFileInput}
          disabled={disabled}
        />
        {children || (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isDragActive
                ? "أفلت الملفات هنا"
                : "اضغط أو اسحب الملفات هنا للرفع"}
            </p>
          </div>
        )}

        {/* Overlay for drag active state if children are provided */}
        {isDragActive && children && (
          <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 border-2 border-blue-500 dark:border-blue-400 rounded-lg pointer-events-none flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg text-blue-600 dark:text-blue-400 font-medium">
              أفلت الملفات هنا
            </div>
          </div>
        )}
      </label>
    </div>
  );
}
