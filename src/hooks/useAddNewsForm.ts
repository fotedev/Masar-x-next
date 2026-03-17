import { useState, useMemo } from "react";
import { Database } from "../types/database";
import { useAuth } from "../contexts/AuthContext";
import { useAcademicOptions } from "../hooks/useAcademicOptions";
import { useSubjects } from "../hooks/useSubjects";
import { uploadToCloudinary } from "../lib/cloudinary";
import { useTranslations } from "next-intl";

type NewsInsert = Database["public"]["Tables"]["news"]["Insert"];

interface UseAddNewsFormProps {
  newNews: NewsInsert;
  onAddNews: (
    news: NewsInsert,
    fileUrl: string | null,
    imageUrls: string[] | null,
    customCategory: string | null,
  ) => void;
}

export function useAddNewsForm({
  newNews,
  onAddNews,
}: UseAddNewsFormProps) {
  const t = useTranslations("news");
  const { user } = useAuth();
  const [semester, setSemester] = useState<number>(1);
  const { levels, getDepartmentsForLevelName } = useAcademicOptions({
    includeInactive: true,
  });

  const [fileFile, setFileFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [customCategory, setCustomCategory] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedLevelNumber = useMemo(() => {
    if (!newNews.year) return undefined;
    const found = levels.find((l) => l.name === newNews.year);
    return typeof found?.level_number === "number" ? found.level_number : undefined;
  }, [levels, newNews.year]);

  const { subjects, loading: subjectsLoading } = useSubjects({
    level: selectedLevelNumber,
    semester: newNews.year ? semester : undefined,
  });

  const availableDepartments = useMemo(() => {
    if (!newNews.year) return [];
    return getDepartmentsForLevelName(newNews.year);
  }, [newNews.year, getDepartmentsForLevelName]);

  const handleAddNews = async () => {
    if (!user) {
      setError(t("newsLoginRequired"));
      return;
    }

    setLoading(true);
    setError("");
    let fileUrl: string | null = null;
    const imageUrls: string[] = [];

    try {
      if (fileFile) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024;
        if (fileFile.size > MAX_FILE_SIZE) {
          setError(t("newsFileSizeError"));
          setLoading(false);
          return;
        }
        const result = await uploadToCloudinary(fileFile, {
          folder: "masarx-news-files",
        });
        fileUrl = result.url;
      }

      if (imageFiles.length > 0) {
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
        for (const imageFile of imageFiles) {
          if (imageFile.size > MAX_IMAGE_SIZE) {
            setError(t("newsImageSizeError", { name: imageFile.name }));
            setLoading(false);
            return;
          }
          const result = await uploadToCloudinary(imageFile, {
            folder: "masarx-news-images",
          });
          imageUrls.push(result.url);
        }
      }

      const finalNewsData: NewsInsert = {
        ...newNews,
        type:
          newNews.type === "custom"
            ? "announcement"
            : (newNews.type as string),
      };

      onAddNews(finalNewsData, fileUrl, imageUrls, customCategory);
      setFileFile(null);
      setImageFiles([]);
      setCustomCategory("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("newsUploadError"));
    } finally {
      setLoading(false);
    }
  };

  return {
    semester,
    setSemester,
    levels,
    subjects,
    subjectsLoading,
    availableDepartments,
    fileFile,
    setFileFile,
    imageFiles,
    setImageFiles,
    customCategory,
    setCustomCategory,
    loading,
    error,
    setError,
    handleAddNews,
  };
}
