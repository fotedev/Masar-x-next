import { User, Camera } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect } from "react";
import Image from "next/image";
import { FileDropzone } from "./FileDropzone";
import { toast } from "sonner";

interface AdminProfileImageProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showIcon?: boolean;
  editable?: boolean;
}

export function AdminProfileImage({
  size = "md",
  className = "",
  showIcon = true,
  editable = false,
}: AdminProfileImageProps) {
  const { isAdmin, avatarUrl, updateAvatar } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  // Safety effect: reset isUploading if avatarUrl changes, or after a timeout
  useEffect(() => {
    if (isUploading) {
      // If the URL changed, the upload definitely succeeded
      const timer = setTimeout(() => {
        setIsUploading(false);
      }, 5000); // 5s safety timeout

      return () => clearTimeout(timer);
    }
  }, [isUploading, avatarUrl]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة فقط");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    setIsUploading(true);
    try {
      await updateAvatar(file);
      // Wait for a small delay to ensure AuthContext state has propagated if needed
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Upload error in component:", error);
      toast.error("حدث خطأ في رفع الصورة", {
        description: "يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  };

  const iconSizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-10 h-10",
  };

  return (
    <div className={`relative ${sizeClasses[size]} rounded-full ${className}`}>
      <FileDropzone
        disabled={!editable || isUploading}
        onFileSelect={(files) => {
          if (files.length > 0) {
            // Create synthetic event to reuse logic
            const syntheticEvent = {
              target: { files: [files[0]] },
            } as any;
            handleFileSelect(syntheticEvent);
          }
        }}
        accept="image/*"
        className="w-full h-full rounded-full"
      >
        <div
          className={`w-full h-full rounded-full flex items-center justify-center relative overflow-hidden ${
            isAdmin
              ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.6)] border-2 border-blue-400 animate-pulse ring-2 ring-blue-400/50"
              : "bg-gray-300 dark:bg-gray-600"
          } ${
            editable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
          }`}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Profile"
              fill
              className="object-cover rounded-full"
              unoptimized
            />
          ) : (
            showIcon && (
              <User className={`${iconSizeClasses[size]} text-white`} />
            )
          )}

          {isAdmin && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-20"></div>
              <div className="absolute inset-0 rounded-full bg-blue-400/10 animate-pulse"></div>
            </>
          )}

          {editable && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      </FileDropzone>
    </div>
  );
}
