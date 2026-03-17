import { useState, useEffect } from "react";
import { Database } from "../types/database";
import { toast } from "sonner";

type SubjectInsert = Database["public"]["Tables"]["subjects"]["Insert"];

interface UseAddSubjectFormProps {
  editingSubject?: Database["public"]["Tables"]["subjects"]["Row"] | null;
  show: boolean;
  onSave: (subject: SubjectInsert) => Promise<void>;
  onClose: () => void;
}

interface SubjectFormData {
  name: string;
  professor: string;
  professor_gender: "male" | "female";
  description: string;
  schedule: string;
  location: string;
  level: number;
  semester: number;
  is_academic: boolean;
  show_on_home: boolean;
  status: string;
}

export function useAddSubjectForm({
  editingSubject,
  show,
  onSave,
  onClose,
}: UseAddSubjectFormProps) {
  const [formData, setFormData] = useState<SubjectFormData>({
    name: "",
    professor: "",
    professor_gender: "male",
    description: "",
    schedule: "",
    location: "",
    level: 1,
    semester: 1,
    is_academic: true,
    show_on_home: true,
    status: "pending",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingSubject) {
      setFormData({
        name: editingSubject.name,
        professor: editingSubject.professor || "",
        professor_gender: (editingSubject as unknown as { professor_gender: "male" | "female" }).professor_gender || "male",
        description: editingSubject.description || "",
        schedule: editingSubject.schedule || "",
        location: editingSubject.location || "",
        level: editingSubject.level || 1,
        semester: editingSubject.semester || 1,
        is_academic: editingSubject.is_academic ?? true,
        show_on_home: !!editingSubject.show_on_home,
        status: editingSubject.status || "pending",
      });
    } else {
      resetForm();
    }
  }, [editingSubject, show]);

  const resetForm = () => {
    setFormData({
      name: "",
      professor: "",
      professor_gender: "male",
      description: "",
      schedule: "",
      location: "",
      level: 1,
      semester: 1,
      is_academic: true,
      show_on_home: true,
      status: "pending",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError("يرجى إدخال اسم المادة");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave(formData);
      onClose();
      toast.success("تم حفظ المادة بنجاح", {
        description: editingSubject
          ? "تم تحديث بيانات المادة."
          : "تمت إضافة المادة الجديدة إلى النظام.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "حدث خطأ أثناء حفظ المادة";
      setError(message);
      toast.error("خطأ في الحفظ", {
        description:
          message || "حدث خطأ أثناء حفظ المادة، يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    loading,
    error,
    setError,
    handleSubmit,
  };
}
