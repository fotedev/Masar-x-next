"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/lib/cloudinary";

interface ContentFormState {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

interface ContentFormOptions {
  onSuccess?: () => void;
  action: (
    prevState: ContentFormState | null,
    formData: FormData,
  ) => Promise<ContentFormState>;
}

export function useContentForm({ onSuccess, action }: ContentFormOptions) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.message || "Success");
      onSuccess?.();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File | null;

    if (file && file.size > 0) {
      setIsUploading(true);
      try {
        const folder = (formData.get("folder") as string) || "masarx-uploads";
        const result = await uploadToCloudinary(file, {
          folder,
          onProgress: (progress, stage) => {
            setUploadProgress(progress);
            setUploadStage(stage);
          },
        });

        // Append the uploaded URL to the formData before submitting to the action
        formData.set("fileUrl", result.url);
        // Note: For videos, the field name might be different, handled by the form implementation
        if (formData.has("url") && !formData.get("url")) {
          formData.set("url", result.url);
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        toast.error(message);
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    formAction(formData);
  };

  return {
    state,
    handleSubmit,
    isPending: isPending || isUploading,
    isUploading,
    uploadProgress,
    uploadStage,
  };
}
