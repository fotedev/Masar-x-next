import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { confirmToast } from "@/lib/confirmToast";
import { queryCache, cacheKeys } from "@/lib/queryCache";

interface UseManageLecturesProps {
  show: boolean;
  subjectName: string;
  standardizedSubject: string;
}

export function useManageLectures({
  show,
  subjectName,
  standardizedSubject,
}: UseManageLecturesProps) {
  const [lectures, setLectures] = useState<any[]>([]);
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
      console.error("Error fetching lectures:", error);
    } finally {
      setLoading(false);
    }
  }, [subjectName]);

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
      console.error("Unauthorized: Only admins can add lectures");
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
    } catch (error) {
      console.error("Error adding lecture:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirmToast("هل أنت متأكد من حذف هذه المحاضرة؟", {
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
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
    } catch (error) {
      console.error("Error deleting lecture:", error);
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
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
    } catch (error) {
      console.error("Error updating lecture:", error);
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
