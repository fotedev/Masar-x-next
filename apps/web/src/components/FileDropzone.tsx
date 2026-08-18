import { type ReactNode } from "react";
import { useState, useCallback, type DragEvent, type ChangeEvent } from "react";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";

interface FileDropzoneProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function FileDropzone({
  onFileSelect,
  accept,
  multiple = false,
  children,
  className = "",
  disabled = false,
  id,
}: FileDropzoneProps) {
  const t = useTranslations("fileDropzone");
  const [isDragActive, setIsDragActive] = useState(false);
  const inputId = id || "file-upload-input";

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragActive(false);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
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
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragActive(false);

      if (disabled) return;

      if (e.dataTransfer) {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          validateAndPassFiles(files);
        }
      }
    },
    [disabled, validateAndPassFiles],
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        validateAndPassFiles(Array.from(e.target.files));
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
        htmlFor={inputId}
        className={`cursor-pointer block w-full h-full transition-colors ${
          isDragActive
            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400"
            : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input
          id={inputId}
          name={inputId}
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
              {isDragActive ? t("active") : t("idle")}
            </p>
          </div>
        )}

        {/* Overlay for drag active state if children are provided */}
        {isDragActive && children && (
          <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 border-2 border-blue-500 dark:border-blue-400 rounded-lg pointer-events-none flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg text-blue-600 dark:text-blue-400 font-medium">
              {t("active")}
            </div>
          </div>
        )}
      </label>
    </div>
  );
}
