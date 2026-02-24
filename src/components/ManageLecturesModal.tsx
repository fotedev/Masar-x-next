import { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  BookOpen,
  Edit as EditIcon,
  FileText,
  Video,
  ClipboardList,
  ExternalLink,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { confirmToast } from "../lib/confirmToast";

interface ManageLecturesModalProps {
  show: boolean;
  onClose: () => void;
  subjectName: string;
}

export function ManageLecturesModal({
  show,
  onClose,
  subjectName,
}: ManageLecturesModalProps) {
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLectureContent, setShowLectureContent] = useState(false);
  const [selectedLectureForContent, setSelectedLectureForContent] = useState<
    any | null
  >(null);
  const [editLecture, setEditLecture] = useState({
    id: "" as string,
    label: "" as string,
    orderIndex: "" as string,
  });
  const [newLecture, setNewLecture] = useState({ title: "", orderIndex: "" });

  const standardizedSubject = decodeURIComponent(subjectName)
    .trim()
    .replace(/\s+/g, " ");

  useEffect(() => {
    if (show && subjectName) {
      fetchLectures();
    }
  }, [show, subjectName]);

  async function fetchLectures() {
    try {
      setLoading(true);

      // Standardize the subject name for matching
      const decodedName = decodeURIComponent(subjectName).trim();
      const normalizedName = decodedName.replace(/\s+/g, " ");

      // Use ILIKE for case-insensitive and more flexible matching with Arabic characters
      // We use % around the term to ensure we find matches even with slight variations
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
  }

  const handleAddLecture = async () => {
    if (!newLecture.title.trim()) return;
    try {
      const order = newLecture.orderIndex
        ? parseInt(newLecture.orderIndex)
        : 999;

      const { error } = await supabase.from("subject_lectures").insert({
        subject: standardizedSubject,
        lecture_label: newLecture.title,
        lecture_key: `lec-${Date.now()}`,
        order_index: order,
      });
      if (error) throw error;
      setNewLecture({ title: "", orderIndex: "" });
      fetchLectures();
    } catch (error) {
      console.error("Error adding lecture:", error);
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
      setEditingId(null);
      fetchLectures();
    } catch (error) {
      console.error("Error updating lecture:", error);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                إدارة المحاضرات
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subjectName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add New Lecture */}
          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-3">
              إضافة محاضرة جديدة
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="عنوان المحاضرة"
                value={newLecture.title}
                onChange={(e) =>
                  setNewLecture({ ...newLecture, title: e.target.value })
                }
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              />
              <input
                type="number"
                placeholder="الترتيب"
                value={newLecture.orderIndex}
                onChange={(e) =>
                  setNewLecture({ ...newLecture, orderIndex: e.target.value })
                }
                className="w-20 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              />
              <button
                onClick={handleAddLecture}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lectures List */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : lectures.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                لا توجد محاضرات مضافة بعد
              </div>
            ) : (
              lectures.map((lec) => (
                <div
                  key={lec.id}
                  className="group flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-transparent hover:border-blue-500/30 transition-all"
                >
                  {editingId === lec.id ? (
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={editLecture.label}
                          onChange={(e) =>
                            setEditLecture((p) => ({
                              ...p,
                              label: e.target.value,
                            }))
                          }
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                        />
                        <input
                          type="number"
                          value={editLecture.orderIndex}
                          onChange={(e) =>
                            setEditLecture((p) => ({
                              ...p,
                              orderIndex: e.target.value,
                            }))
                          }
                          className="w-24 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const label = (editLecture.label || "").trim();
                            const orderNum = Number(editLecture.orderIndex);

                            if (!label) return;

                            handleUpdate(lec.id, {
                              lecture_label: label,
                              order_index: Number.isFinite(orderNum)
                                ? Math.floor(orderNum)
                                : 999999,
                              updated_at: new Date().toISOString(),
                            });
                          }}
                          className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-all"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                          }}
                          className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-400">
                          {lec.order_index}
                        </span>
                        <span className="font-bold text-gray-700 dark:text-gray-200">
                          {lec.lecture_label}
                        </span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setSelectedLectureForContent(lec);
                            setShowLectureContent(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                          title="إدارة محتوى المحاضرة"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(lec.id);
                            setEditLecture({
                              id: lec.id,
                              label: lec.lecture_label || "",
                              orderIndex:
                                lec.order_index === null ||
                                lec.order_index === undefined
                                  ? ""
                                  : String(lec.order_index),
                            });
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(lec.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <LectureContentModal
        show={showLectureContent}
        onClose={() => {
          setShowLectureContent(false);
          setSelectedLectureForContent(null);
        }}
        subject={standardizedSubject}
        lecture={selectedLectureForContent}
        lecturesIndex={lectures}
      />
    </div>
  );
}

function inferLectureKeyFromTitle(
  title: string,
  lecturesIndex: Array<{ lecture_key?: string; lecture_label?: string }>,
): string {
  const t = (title || "").trim();
  if (!t) return "other";

  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedTitle = clean(t);

  // 1. Exact match (case-insensitive)
  const exact = lecturesIndex.find((l) => {
    const key = (l.lecture_key || "").trim().toLowerCase();
    const label = clean(l.lecture_label || "");
    return (
      (key && key === normalizedTitle) || (label && label === normalizedTitle)
    );
  });
  if (exact?.lecture_key) return exact.lecture_key;

  // 1.5 Prefix match against lecture_key (common when admin adds content via query param)
  const keyPrefix = lecturesIndex.find((l) => {
    const key = (l.lecture_key || "").trim().toLowerCase();
    if (!key) return false;
    return normalizedTitle.startsWith(key);
  });
  if (keyPrefix?.lecture_key) return keyPrefix.lecture_key;

  // Sort lectures by label length descending to match most specific/longest first
  const sortedLectures = [...lecturesIndex].sort(
    (a, b) => (b.lecture_label?.length || 0) - (a.lecture_label?.length || 0),
  );

  // 2. Delimiter match for prefixes/suffixes
  // Handles "محاضرة 1: فيديو تدريبي" -> matches "محاضرة 1"
  const titleParts = t.split(/[:\-\|]/).map((p) => clean(p));

  for (const part of titleParts) {
    if (!part || part.length < 2) continue;
    const match = sortedLectures.find((l) => {
      const key = (l.lecture_key || "").trim().toLowerCase();
      const label = clean(l.lecture_label || "");
      return (
        (key &&
          (key === part || part.startsWith(key) || key.startsWith(part))) ||
        (label &&
          (label === part || part.includes(label) || label.includes(part)))
      );
    });
    if (match?.lecture_key) return match.lecture_key;
  }

  // 3. Substring match (Check if any lecture label is contained within the title)
  const partial = sortedLectures.find((l) => {
    const key = (l.lecture_key || "").trim().toLowerCase();
    const label = clean(l.lecture_label || "");
    if (key && key.length >= 2) {
      if (normalizedTitle.includes(key) || key.includes(normalizedTitle))
        return true;
    }
    if (label && label.length >= 2) {
      return normalizedTitle.includes(label) || label.includes(normalizedTitle);
    }
    return false;
  });
  if (partial?.lecture_key) return partial.lecture_key;

  return "other";
}

function LectureContentModal({
  show,
  onClose,
  subject,
  lecture,
  lecturesIndex,
}: {
  show: boolean;
  onClose: () => void;
  subject: string;
  lecture: any | null;
  lecturesIndex: any[];
}) {
  const [activeTab, setActiveTab] = useState<
    "summaries" | "videos" | "files" | "quizzes"
  >("summaries");
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);

  const lectureKey = (lecture?.lecture_key || "").trim() || "other";
  const lectureLabel = (lecture?.lecture_label || "").trim() || "غير مصنف";

  useEffect(() => {
    if (!show || !subject) return;
    if (!lecture) return;

    async function fetchAll() {
      try {
        setLoading(true);

        const [summariesRes, videosRes, filesRes, quizzesRes] =
          await Promise.all([
            supabase
              .from("summaries")
              .select("id,title,subject,status,created_at,lecture_key")
              .eq("subject", subject)
              .order("created_at", { ascending: false })
              .limit(400),
            supabase
              .from("videos")
              .select("id,title,subject,url,language,created_at,lecture_key")
              .eq("subject", subject)
              .order("created_at", { ascending: false })
              .limit(400),
            supabase
              .from("files")
              .select("id,title,subject,file_url,description,created_at")
              .eq("subject", subject)
              .order("created_at", { ascending: false })
              .limit(400),
            supabase
              .from("quizzes")
              .select("id,title,description,created_at")
              .order("created_at", { ascending: false })
              .limit(500),
          ]);

        if (summariesRes.error) throw summariesRes.error;
        if (videosRes.error) throw videosRes.error;
        if (filesRes.error) throw filesRes.error;
        if (quizzesRes.error) throw quizzesRes.error;

        const lectureMatch = (row: any) => {
          // 1. If there's an explicit lecture_key on the row, use it
          if (
            row.lecture_key &&
            String(row.lecture_key).trim() === String(lectureKey).trim()
          )
            return true;

          // 2. Otherwise fallback to title inference
          const inferredKey = inferLectureKeyFromTitle(
            row?.title || "",
            lecturesIndex,
          );
          return inferredKey === lectureKey;
        };

        const filteredSummaries = (summariesRes.data || []).filter(
          lectureMatch,
        );
        const filteredVideos = (videosRes.data || []).filter(lectureMatch);
        const filteredFiles = (filesRes.data || []).filter(lectureMatch);

        setSummaries(filteredSummaries);
        setVideos(filteredVideos);
        setFiles(filteredFiles);

        const quizzesForSubject = (quizzesRes.data || []).filter((q: any) => {
          const raw = q?.description;
          if (typeof raw !== "string") return false;
          if (!raw.trim().startsWith("{")) return false;
          try {
            const parsed = JSON.parse(raw);
            return (
              typeof parsed?.subject === "string" && parsed.subject === subject
            );
          } catch {
            return false;
          }
        });
        setQuizzes(quizzesForSubject.filter(lectureMatch));
      } catch (e) {
        console.error("Error fetching lecture content:", e);
        setSummaries([]);
        setVideos([]);
        setFiles([]);
        setQuizzes([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [lecture, lectureKey, lecturesIndex, show, subject]);

  const openSubjectLecture = () => {
    const url = `/subjects/${encodeURIComponent(subject)}?lecture=${encodeURIComponent(lectureKey)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDeleteVideo = async (id: string) => {
    const confirmed = await confirmToast("هل أنت متأكد من حذف هذا الفيديو؟", {
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
    });
    if (!confirmed) return;
    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (!error) setVideos((p) => p.filter((v) => v.id !== id));
  };

  const handleDeleteFile = async (id: string) => {
    const confirmed = await confirmToast("هل أنت متأكد من حذف هذا الملف؟", {
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
    });
    if (!confirmed) return;
    const { error } = await supabase.from("files").delete().eq("id", id);
    if (!error) setFiles((p) => p.filter((f) => f.id !== id));
  };

  const handleDeleteQuiz = async (id: string) => {
    const confirmed = await confirmToast("هل أنت متأكد من حذف هذا الاختبار؟", {
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
    });
    if (!confirmed) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (!error) setQuizzes((p) => p.filter((q) => q.id !== id));
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                إدارة محتوى المحاضرة
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subject} • {lectureLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openSubjectLecture}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
              title="فتح صفحة المادة على نفس المحاضرة"
            >
              <ExternalLink className="w-4 h-4" />
              فتح
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("summaries")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === "summaries"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            ملخصات ({summaries.length})
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === "videos"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            }`}
          >
            <Video className="w-4 h-4" />
            فيديوهات ({videos.length})
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === "files"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            ملفات ({files.length})
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === "quizzes"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            اختبارات ({quizzes.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : activeTab === "summaries" ? (
            summaries.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                لا توجد ملخصات مرتبطة بهذه المحاضرة
              </div>
            ) : (
              <div className="space-y-2">
                {summaries.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 dark:text-gray-100">
                        {s.title}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        الحالة: {s.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {s.created_at
                        ? new Date(s.created_at).toLocaleString()
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "videos" ? (
            videos.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                لا توجد فيديوهات مرتبطة بهذه المحاضرة
              </div>
            ) : (
              <div className="space-y-2">
                {videos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 dark:text-gray-100">
                        {v.title}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {v.language === "en" ? "English" : "عربي"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                        title="فتح الرابط"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteVideo(v.id)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "files" ? (
            files.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                لا توجد ملفات مرتبطة بهذه المحاضرة
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 dark:text-gray-100">
                        {f.title}
                      </span>
                      {f.description ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {f.description}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={f.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                        title="فتح الرابط"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteFile(f.id)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : quizzes.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
              لا توجد اختبارات مرتبطة بهذه المحاضرة
            </div>
          ) : (
            <div className="space-y-2">
              {quizzes.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 dark:text-gray-100">
                      {q.title}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteQuiz(q.id)}
                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
