import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { getPostgrestMessage, isUniqueViolation } from "@/lib/postgrestError";
import { confirmToast } from "@/lib/confirmToast";
import { queryCache, cacheKeys } from "@/lib/queryCache";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface UseManageLecturesProps {
  show: boolean;
  subjectName: string;
  standardizedSubject: string;
}

interface SubjectLecture {
  id: string;
  subject: string;
  lecture_label: string;
  lecture_key: string;
  order_index: number;
  created_at: string;
}

export function useManageLectures({
  show,
  subjectName,
  standardizedSubject,
}: UseManageLecturesProps) {
  const t = useTranslations("subjectPage");
  const [lectures, setLectures] = useState<SubjectLecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newLecture, setNewLecture] = useState({ title: "", orderIndex: "" });
  const [editLecture, setEditLecture] = useState({
    id: "",
    label: "",
    orderIndex: "",
  });

  const fetchLectures = useCallback(async () => {
    try {
      setLoading(true);
      const decodedName = decodeURIComponent(subjectName).trim();
      const normalizedName = decodedName.replace(/\s+/g, " ");

      const { data, error } = await supabase
        .from("subject_lectures")
        .select("*")
        .or(
          `subject.ilike.%${normalizedName}%,subject.ilike.%${decodedName}%,subject.ilike.%${subjectName}%`,
        )
        .order("order_index", { ascending: true });

      if (error) throw error;
      setLectures(data || []);
    } catch (error) {
      logger.error("Error fetching lectures", error, { subjectName });
      toast.error(t("manageLectures.loadError"));
    } finally {
      setLoading(false);
    }
  }, [subjectName, t]);

  useEffect(() => {
    if (show && subjectName) {
      fetchLectures();
    }
  }, [show, subjectName, fetchLectures]);

  const handleAddLecture = async () => {
    if (!newLecture.title.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: admin } = await supabase
      .from("admins")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!admin) {
      const errorMsg = "Unauthorized: Only admins can add lectures";
      logger.error(errorMsg, null, { userId: user.id });
      toast.error(t("manageLectures.unauthorizedAdd"));
      return;
    }

    try {
      setLoading(true);
      const order = newLecture.orderIndex
        ? parseInt(newLecture.orderIndex)
        : 999999;

      const { error } = await supabase.from("subject_lectures").insert({
        subject: standardizedSubject,
        lecture_label: newLecture.title.trim(),
        lecture_key: `lec-${Date.now()}`,
        order_index: Number.isFinite(order) ? order : 999999,
      });
      if (error) throw error;

      // Invalidate cache
      queryCache.invalidate(cacheKeys.subjectLectures(subjectName));

      setNewLecture({ title: "", orderIndex: "" });
      fetchLectures();
      toast.success(t("manageLectures.addSuccess"));
    } catch (error) {
      logger.error("Error adding lecture", error, {
        subjectName,
        lectureTitle: newLecture.title,
      });
      toast.error(t("manageLectures.addError"), {
        description: isUniqueViolation(error, "subject_lectures")
          ? t("manageLectures.duplicateLecture")
          : getPostgrestMessage(error) || undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmToast(t("manageLectures.deleteConfirm"), {
      confirmLabel: t("lectureForm.delete"),
      cancelLabel: t("lectureForm.cancel"),
    });
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from("subject_lectures")
        .delete()
        .eq("id", id);
      if (error) throw error;

      // Invalidate cache
      queryCache.invalidate(cacheKeys.subjectLectures(subjectName));

      fetchLectures();
      toast.success(t("manageLectures.deleteSuccess"));
    } catch (error) {
      logger.error("Error deleting lecture", error, { id });
      toast.error(t("manageLectures.deleteError"), {
        description: getPostgrestMessage(error) || undefined,
      });
    }
  };

  const handleUpdate = async (id: string, updates: Partial<SubjectLecture>) => {
    try {
      const { error } = await supabase
        .from("subject_lectures")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Invalidate cache
      queryCache.invalidate(cacheKeys.subjectLectures(subjectName));

      setEditingId(null);
      fetchLectures();
      toast.success(t("manageLectures.updateSuccess"));
    } catch (error) {
      logger.error("Error updating lecture", error, { id, updates });
      toast.error(t("manageLectures.updateError"), {
        description: isUniqueViolation(error, "subject_lectures")
          ? t("manageLectures.duplicateLecture")
          : getPostgrestMessage(error) || undefined,
      });
    }
  };

  return {
    lectures,
    loading,
    editingId,
    setEditingId,
    newLecture,
    setNewLecture,
    editLecture,
    setEditLecture,
    handleAddLecture,
    handleDelete,
    handleUpdate,
  };
}
