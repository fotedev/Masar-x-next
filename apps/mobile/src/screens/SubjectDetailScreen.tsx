/**
 * Subject detail (spec 019 C2): read-only study surface ported from the
 * web /subjects/[subject] page — professor/schedule/location header,
 * lecture index (subject_lectures ordered by order_index) and
 * per-lecture content (summaries, videos, files, exams) matched with
 * the same rules as web's useLectureContent (ported in
 * lib/lecture-content; title-inference stays web-only, so unmatched
 * rows surface in an explicit "unclassified" section).
 *
 * Content is fetched once per subject and grouped client-side, so
 * lecture switching is instant. Videos, files and summary PDFs open
 * externally via Linking (native YouTube app / browser); quizzes route
 * to the existing QuizPlay screen. Mark-complete progress
 * (user_progress) is deliberately out of scope — read-only per spec.
 */
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SupabaseClient } from "masarx-shared/supabase";

import { useI18n } from "../context/I18nContext";
import {
  groupContentByLecture,
  type LectureRef,
  type MatchableRow,
} from "../lib/lecture-content";
import { getSupabaseClient } from "../lib/supabase";
import type { RootStackParamList } from "../../app/App";

interface SubjectDetailRow {
  id: string;
  name: string;
  name_en: string | null;
  professor: string | null;
  professor_ar: string | null;
  description: string | null;
  description_ar: string | null;
  schedule: string | null;
  location: string | null;
}

interface LectureRow extends LectureRef {
  order_index: number;
}

interface SummaryRow extends MatchableRow {
  pdf_url: string | null;
}
interface VideoRow extends MatchableRow {
  url: string;
}
interface FileRow extends MatchableRow {
  file_url: string;
  description: string | null;
}
interface QuizRow extends MatchableRow {
  description: string | null;
}

interface SubjectContent {
  summaries: SummaryRow[];
  videos: VideoRow[];
  files: FileRow[];
  quizzes: QuizRow[];
}

const COLORS = {
  primary: "#4F46E5",
  ink: "#111827",
  subtle: "#6B7280",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  danger: "#DC2626",
  chipActive: "#4F46E5",
  chipInactive: "#EEF2FF",
  chipActiveText: "#FFFFFF",
  chipInactiveText: "#4F46E5",
};

type ContentKind = "summaries" | "videos" | "files" | "quizzes";

const CONTENT_LIMITS: Record<ContentKind, number> = {
  summaries: 400,
  videos: 400,
  files: 400,
  quizzes: 500,
};

async function loadSubjectBundle(supabase: SupabaseClient, subjectName: string) {
  const contentSelects: Record<ContentKind, { table: string; columns: string }> = {
    summaries: {
      table: "summaries",
      columns: "id,title,subject,status,created_at,lecture_key,lecture_id,pdf_url",
    },
    videos: {
      table: "videos",
      columns: "id,title,subject,url,language,created_at,lecture_key,lecture_id",
    },
    files: {
      table: "files",
      columns: "id,title,subject,file_url,description,created_at,lecture_key,lecture_id",
    },
    quizzes: {
      table: "quizzes",
      columns: "id,title,subject,description,created_at,lecture_id",
    },
  };

  const [subjectRes, lecturesRes, summariesRes, videosRes, filesRes, quizzesRes] =
    await Promise.all([
      supabase.from("subjects").select("*").eq("name", subjectName).single(),
      supabase
        .from("subject_lectures")
        .select("id,lecture_key,lecture_label,order_index")
        .eq("subject", subjectName)
        .order("order_index", { ascending: true }),
      ...(Object.keys(contentSelects) as ContentKind[]).map((kind) =>
        supabase
          .from(contentSelects[kind].table)
          .select(contentSelects[kind].columns)
          .eq("subject", subjectName)
          .order("created_at", { ascending: false })
          .limit(CONTENT_LIMITS[kind]),
      ),
    ]);

  if (subjectRes.error) throw subjectRes.error;
  if (lecturesRes.error) throw lecturesRes.error;
  for (const res of [summariesRes, videosRes, filesRes, quizzesRes]) {
    if (res.error) throw res.error;
  }

  return {
    subject: subjectRes.data as unknown as SubjectDetailRow,
    lectures: (lecturesRes.data ?? []) as unknown as LectureRow[],
    content: {
      summaries: (summariesRes.data ?? []) as unknown as SummaryRow[],
      videos: (videosRes.data ?? []) as unknown as VideoRow[],
      files: (filesRes.data ?? []) as unknown as FileRow[],
      quizzes: (quizzesRes.data ?? []) as unknown as QuizRow[],
    },
  };
}

export default function SubjectDetailScreen() {
  const { t, isRTL, locale } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<{ key: string; name: "SubjectDetail"; params: RootStackParamList["SubjectDetail"] }>();
  const subjectName = route.params.subjectName;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState<SubjectDetailRow | null>(null);
  const [lectures, setLectures] = useState<LectureRow[]>([]);
  const [content, setContent] = useState<SubjectContent | null>(null);
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bundle = await loadSubjectBundle(getSupabaseClient(), subjectName);
      setSubject(bundle.subject);
      setLectures(bundle.lectures);
      setContent(bundle.content);
      setSelectedLectureId(bundle.lectures[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [subjectName]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    if (!content) return null;
    return groupContentByLecture(lectures, content);
  }, [content, lectures]);

  const professor =
    locale === "ar"
      ? subject?.professor_ar || subject?.professor || null
      : subject?.professor;
  const description =
    locale === "ar"
      ? subject?.description_ar || subject?.description || null
      : subject?.description;

  const openLink = (url: string) => {
    void Linking.openURL(url).catch(() => {
      // No handler for the scheme on this device — nothing sensible to
      // do in-app; the row stays tappable for a retry.
    });
  };

  const renderRows = <R extends { id: string; title: string }>(
    rows: R[],
    onPress: (row: R) => void,
    actionLabel: string,
  ) =>
    rows.map((row) => (
      <Pressable
        key={row.id}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => onPress(row)}
      >
        <Text style={[styles.rowTitle, isRTL && styles.rtlText]} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={styles.rowAction}>{actionLabel}</Text>
      </Pressable>
    ));

  const renderGroup = (
    title: string,
    empty: boolean,
    rows: React.ReactNode,
  ) => (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, isRTL && styles.rtlText]}>{title}</Text>
      {empty ? (
        <Text style={[styles.emptyGroup, isRTL && styles.rtlText]}>
          {t("mobile", "subjectDetail.emptyGroup")}
        </Text>
      ) : (
        rows
      )}
    </View>
  );

  const selectedGroups =
    grouped && selectedLectureId ? grouped.byLectureId[selectedLectureId] : null;

  const unclassifiedHasContent =
    grouped != null &&
    (grouped.unclassified.summaries.length > 0 ||
      grouped.unclassified.videos.length > 0 ||
      grouped.unclassified.files.length > 0 ||
      grouped.unclassified.quizzes.length > 0);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>{locale === "ar" ? ">" : "<"}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {subjectName}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryButtonText}>{t("mobile", "common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {subject ? (
            <View style={styles.card}>
              <Text style={[styles.subjectName, isRTL && styles.rtlText]}>{subject.name}</Text>
              {subject.name_en ? <Text style={styles.meta}>{subject.name_en}</Text> : null}
              {professor ? (
                <Text style={[styles.meta, isRTL && styles.rtlText]}>
                  {t("mobile", "subjectDetail.professor")}: {professor}
                </Text>
              ) : null}
              {subject.schedule ? (
                <Text style={[styles.meta, isRTL && styles.rtlText]}>
                  {t("mobile", "subjectDetail.schedule")}: {subject.schedule}
                </Text>
              ) : null}
              {subject.location ? (
                <Text style={[styles.meta, isRTL && styles.rtlText]}>
                  {t("mobile", "subjectDetail.location")}: {subject.location}
                </Text>
              ) : null}
              {description ? (
                <Text style={[styles.description, isRTL && styles.rtlText]}>
                  {description}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {t("mobile", "subjectDetail.lectures")}
          </Text>
          {lectures.length === 0 ? (
            <Text style={[styles.emptyGroup, isRTL && styles.rtlText]}>
              {t("mobile", "subjectDetail.noLectures")}
            </Text>
          ) : (
            <View style={styles.chipWrap}>
              {lectures.map((lecture) => {
                const active = lecture.id === selectedLectureId;
                return (
                  <Pressable
                    key={lecture.id}
                    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                    onPress={() => setSelectedLectureId(lecture.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active ? styles.chipTextActive : styles.chipTextInactive,
                      ]}
                      numberOfLines={1}
                    >
                      {lecture.lecture_label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {selectedGroups ? (
            <>
              {renderGroup(
                t("mobile", "tabs.summaries"),
                selectedGroups.summaries.length === 0,
                renderRows(selectedGroups.summaries, (row) => {
                  if (row.pdf_url) openLink(row.pdf_url);
                }, t("mobile", "subjectDetail.open")),
              )}
              {renderGroup(
                t("mobile", "subjectDetail.videos"),
                selectedGroups.videos.length === 0,
                renderRows(selectedGroups.videos, (row) => openLink(row.url), t("mobile", "subjectDetail.open")),
              )}
              {renderGroup(
                t("mobile", "subjectDetail.files"),
                selectedGroups.files.length === 0,
                renderRows(selectedGroups.files, (row) => openLink(row.file_url), t("mobile", "subjectDetail.open")),
              )}
              {renderGroup(
                t("mobile", "subjectDetail.exams"),
                selectedGroups.quizzes.length === 0,
                renderRows(
                  selectedGroups.quizzes,
                  (row) => navigation.navigate("QuizPlay", { quizId: row.id, title: row.title }),
                  t("mobile", "subjectDetail.startQuiz"),
                ),
              )}
            </>
          ) : null}

          {unclassifiedHasContent && grouped ? (
            <View style={styles.group}>
              <Text style={[styles.groupTitle, styles.unclassifiedTitle, isRTL && styles.rtlText]}>
                {t("mobile", "subjectDetail.unclassified")}
              </Text>
              {grouped.unclassified.summaries.length > 0
                ? renderRows(grouped.unclassified.summaries, (row) => {
                    if (row.pdf_url) openLink(row.pdf_url);
                  }, t("mobile", "subjectDetail.open"))
                : null}
              {grouped.unclassified.videos.length > 0
                ? renderRows(grouped.unclassified.videos, (row) => openLink(row.url), t("mobile", "subjectDetail.open"))
                : null}
              {grouped.unclassified.files.length > 0
                ? renderRows(grouped.unclassified.files, (row) => openLink(row.file_url), t("mobile", "subjectDetail.open"))
                : null}
              {grouped.unclassified.quizzes.length > 0
                ? renderRows(
                    grouped.unclassified.quizzes,
                    (row) => navigation.navigate("QuizPlay", { quizId: row.id, title: row.title }),
                    t("mobile", "subjectDetail.startQuiz"),
                  )
                : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backText: { fontSize: 22, fontWeight: "700", color: COLORS.ink, paddingHorizontal: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: COLORS.ink },
  list: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 16,
  },
  subjectName: { fontSize: 19, fontWeight: "800", color: COLORS.ink },
  meta: { fontSize: 13, color: COLORS.subtle, marginTop: 6 },
  description: { fontSize: 13, color: COLORS.subtle, marginTop: 8 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.ink,
    marginBottom: 8,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxWidth: "100%",
  },
  chipActive: { backgroundColor: COLORS.chipActive, borderColor: COLORS.chipActive },
  chipInactive: { backgroundColor: COLORS.chipInactive },
  chipText: { fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: COLORS.chipActiveText },
  chipTextInactive: { color: COLORS.chipInactiveText },
  group: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  groupTitle: { fontSize: 15, fontWeight: "700", color: COLORS.ink, marginBottom: 8 },
  unclassifiedTitle: { color: COLORS.subtle },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowPressed: { opacity: 0.6 },
  rowTitle: { flex: 1, fontSize: 14, color: COLORS.ink },
  rowAction: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
  emptyGroup: { fontSize: 13, color: COLORS.subtle },
  error: { color: COLORS.danger, marginBottom: 12, textAlign: "center" },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
});
