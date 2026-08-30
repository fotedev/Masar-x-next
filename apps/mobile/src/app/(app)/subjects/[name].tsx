import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import {
  fetchSubjectByName,
  fetchLectures,
  fetchLectureContent,
  fetchUserProgressIds,
  toggleUserProgress,
} from "@/lib/api";
import { palette, Card, Chip, EmptyState, ErrorState, ListSkeleton } from "@/components/bits";

type Tab = "lectures" | "summaries" | "files" | "quizzes";

export default function SubjectDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const subjectName = decodeURIComponent(String(name ?? ""));
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("lectures");
  const [activeLectureId, setActiveLectureId] = useState<string | null>(null);
  const [progressIds, setProgressIds] = useState<Set<string> | null>(null);

  const subject = useQuery({
    queryKey: ["subject", subjectName],
    queryFn: () => fetchSubjectByName(subjectName),
  });
  const lectures = useQuery({
    queryKey: ["lectures", subjectName],
    queryFn: () => fetchLectures(subjectName),
  });
  const content = useQuery({
    queryKey: ["lecture-content", subjectName],
    queryFn: () => fetchLectureContent(subjectName),
  });

  const userId = user?.id;
  const progress = useQuery({
    queryKey: ["user-progress", userId],
    queryFn: () => fetchUserProgressIds(userId as string),
    enabled: Boolean(userId),
  });

  useMemo(() => {
    if (progress.data) setProgressIds(progress.data);
  }, [progress.data]);

  if (subject.isError) return <ErrorState message="تعذّر تحميل المادة" onRetry={() => subject.refetch()} />;
  if (subject.isLoading || lectures.isLoading || content.isLoading) return <ListSkeleton rows={5} />;
  if (!subject.data) return <EmptyState title="المادة غير موجودة" />;

  const s = subject.data;
  const lectureRows = lectures.data ?? [];
  const all = content.data ?? { summaries: [], videos: [], files: [], quizzes: [] };

  const selectedLecture = lectureRows.find((l) => l.id === activeLectureId) ?? null;
  const matches = (item: { lecture_id?: string | null; lecture_key?: string | null }) => {
    if (!selectedLecture) return true;
    if (item.lecture_id && item.lecture_id === selectedLecture.id) return true;
    if (item.lecture_key && selectedLecture.lecture_key && item.lecture_key === selectedLecture.lecture_key) return true;
    return false;
  };

  const visibleSummaries = all.summaries.filter(matches);
  const visibleVideos = all.videos.filter(matches);
  const visibleFiles = all.files.filter(matches);
  const visibleQuizzes = all.quizzes.filter(matches);

  const toggleProgress = async (contentId: string) => {
    if (!userId) return;
    const next = new Set(progressIds ?? []);
    const isDone = next.has(contentId);
    if (isDone) next.delete(contentId);
    else next.add(contentId);
    setProgressIds(next);
    try {
      await toggleUserProgress(userId, contentId, !isDone);
      queryClient.invalidateQueries({ queryKey: ["user-progress", userId] });
    } catch {
      setProgressIds(progress.data ?? new Set());
    }
  };

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: "lectures", label: "المحاضرات" },
    { key: "summaries", label: `الملخصات (${visibleSummaries.length})` },
    { key: "files", label: `الملفات (${visibleFiles.length})` },
    { key: "quizzes", label: `الاختبارات (${visibleQuizzes.length})` },
  ];

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={styles.container}>
      <Card>
        <Text style={styles.title}>{s.name}</Text>
        {s.professor ? <Text style={styles.meta}>د. {s.professor}</Text> : null}
        {s.schedule ? <Text style={styles.meta}>📅 {s.schedule}</Text> : null}
        {s.location ? <Text style={styles.meta}>📍 {s.location}</Text> : null}
        {s.description ? <Text style={styles.description}>{s.description}</Text> : null}
      </Card>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            hitSlop={2}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "lectures" ? (
        lectureRows.length === 0 ? (
          <EmptyState title="لا توجد محاضرات مضافة بعد" />
        ) : (
          lectureRows.map((l) => (
            <Card key={l.id}>
              <Pressable
                onPress={() => {
                  setActiveLectureId(l.id === activeLectureId ? null : l.id);
                  setTab("summaries");
                }}
              >
                <View style={styles.headRow}>
                  <Text style={styles.lectureTitle}>{l.lecture_label || l.lecture_key}</Text>
                  {progressIds?.has(l.id) ? <Chip text="✓ مكتملة" /> : null}
                </View>
                <Text style={styles.meta}>اضغط لعرض محتوى المحاضرة</Text>
              </Pressable>
            </Card>
          ))
        )
      ) : null}

      {tab === "summaries" ? (
        visibleSummaries.length === 0 ? (
          <EmptyState title="لا توجد ملخصات هنا" />
        ) : (
          visibleSummaries.map((sm) => (
            <Card key={sm.id}>
              <Pressable onPress={() => toggleProgress(sm.id)} hitSlop={6}>
                <View style={styles.headRow}>
                  <Text style={styles.itemTitle}>{sm.title}</Text>
                  {progressIds?.has(sm.id) ? <Chip text="✓" /> : null}
                </View>
              </Pressable>
            </Card>
          ))
        )
      ) : null}

      {tab === "files" ? (
        (visibleFiles.length === 0 && visibleVideos.length === 0) ? (
          <EmptyState title="لا توجد ملفات أو فيديوهات هنا" />
        ) : (
          <>
            {visibleVideos.map((v) => (
              <Card key={v.id}>
                <Text style={styles.itemTitle}>🎬 {v.title}</Text>
              </Card>
            ))}
            {visibleFiles.map((f) => (
              <Card key={f.id}>
                <Text style={styles.itemTitle}>📄 {f.title}</Text>
                {f.description ? <Text style={styles.meta}>{f.description}</Text> : null}
              </Card>
            ))}
          </>
        )
      ) : null}

      {tab === "quizzes" ? (
        visibleQuizzes.length === 0 ? (
          <EmptyState title="لا توجد اختبارات هنا" />
        ) : (
          visibleQuizzes.map((q) => (
            <Card key={q.id}>
              <Text style={styles.itemTitle}>🧪 {q.title}</Text>
            </Card>
          ))
        )
      ) : null}

      {!user ? <Text style={styles.loginNote}>سجّل الدخول لتسجيل تقدمك في المحاضرات</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: "800", color: palette.text },
  meta: { color: palette.textMuted, fontSize: 13, marginTop: 4 },
  description: { color: palette.text, fontSize: 14, lineHeight: 22, marginTop: 8 },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tabBtn: { borderRadius: 999, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#ffffff" },
  tabBtnActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  tabText: { fontSize: 13, color: palette.textMuted },
  tabTextActive: { color: "#ffffff", fontWeight: "700" },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lectureTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: palette.text },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: palette.text },
  loginNote: { color: palette.textMuted, fontSize: 12, textAlign: "center", marginTop: 8 },
});
