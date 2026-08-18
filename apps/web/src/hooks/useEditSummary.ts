import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useAcademicOptions } from "../hooks/useAcademicOptions";
import { useSubjects } from "../hooks/useSubjects";
import type { Summary, SummaryWithRatings } from "../types/database";

interface UseEditSummaryProps {
  summary: Summary | SummaryWithRatings | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Summary>) => Promise<void>;
}

export function useEditSummary({
  summary,
  isOpen,
  onClose,
  onSave,
}: UseEditSummaryProps) {
  const { user } = useAuth();
  const { levels, getDepartmentsForLevelName } = useAcademicOptions();
  const [semester, setSemester] = useState<number>(1);

  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    year: "",
    department: "",
    content: "",
  });

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attachmentType, setAttachmentType] = useState<"file" | "link">("file");
  const [driveLink, setDriveLink] = useState<string>("");

  const selectedLevelNumber = useMemo(() => {
    if (!formData.year) return null;
    const found = levels.find((l) => l.name === formData.year);
    return typeof found?.level_number === "number" ? found.level_number : null;
  }, [formData.year, levels]);

  const { subjects } = useSubjects({
    level: selectedLevelNumber,
    semester: typeof semester === "number" ? semester : null,
  });

  const availableDepartments = useMemo(() => {
    if (!formData.year) return [];
    return getDepartmentsForLevelName(formData.year);
  }, [formData.year, getDepartmentsForLevelName]);

  useEffect(() => {
    if (summary && isOpen) {
      setFormData({
        title: summary.title,
        subject: summary.subject,
        year: summary.year,
        department: summary.department,
        content: summary.content,
      });
      setSemester(1);
      setPdfFile(null);
      setAttachmentType("file");
      setDriveLink("");
      setError("");
    }
  }, [summary, isOpen]);

  useEffect(() => {
    if (!formData.year) {
      if (formData.department) {
        setFormData((prev) => ({ ...prev, department: "" }));
      }
      return;
    }

    if (formData.department) {
      const exists = availableDepartments.some(
        (d) => d.name === formData.department,
      );
      if (!exists) {
        setFormData((prev) => ({ ...prev, department: "" }));
      }
    }
  }, [formData.year, formData.department, availableDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary || !user) return;

    setLoading(true);
    setError("");

    try {
      if (attachmentType === "link" && driveLink.trim()) {
        try {
          new URL(driveLink.trim());
        } catch {
          setError("يرجى إدخال رابط صحيح");
          setLoading(false);
          return;
        }
      } else if (attachmentType === "link" && !driveLink.trim()) {
        setError("يرجى إدخال رابط Google Drive أو اختر رفع ملف");
        setLoading(false);
        return;
      }

      let pdfUrl = summary.pdf_url;

      if (attachmentType === "file" && pdfFile) {
        const originalName = pdfFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const timestamp = Date.now();
        const filePath = `summaries/${timestamp}_${originalName}`;

        const { error: uploadError } = await supabase.storage
          .from("summaries-pdfs")
          .upload(filePath, pdfFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("summaries-pdfs").getPublicUrl(filePath);

        pdfUrl = publicUrl;
      } else if (attachmentType === "link") {
        pdfUrl = driveLink.trim() || null;
      }

      await onSave(summary.id, {
        title: formData.title,
        subject: formData.subject,
        year: formData.year,
        department: formData.department,
        content: formData.content,
        pdf_url: pdfUrl,
      });

      onClose();
    } catch {
      setError("حدث خطأ أثناء تحديث الملخص. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    semester,
    setSemester,
    levels,
    subjects,
    availableDepartments,
    pdfFile,
    setPdfFile,
    loading,
    error,
    setError,
    attachmentType,
    setAttachmentType,
    driveLink,
    setDriveLink,
    handleSubmit,
  };
}
