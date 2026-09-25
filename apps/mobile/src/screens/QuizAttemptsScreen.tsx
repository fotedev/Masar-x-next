/**
 * Quiz attempts history (spec 019 C6/T097) — the mobile port of the
 * web /quiz-attempts page. Merges the signed-in user's DB attempts
 * (quiz_attempts + quizzes(title), own-rows RLS — answers jsonb is
 * written at finish since spec 019) with on-device guest results
 * (quiz_guest_result: keys, newest per quiz), dedups by id (DB wins),
 * and renders a basic expandable review: per-question via MathText
 * with selected-vs-correct indicators and the explanation.
 */
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SupabaseClient } from "masarx-shared/supabase";

import type { RootStackParamList } from "../../app/App";
import MathText from "../components/MathText";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import type { Palette } from "../lib/theme";
import {
  fetchQuizWithQuestions,
  listGuestResults,
  type GuestAnswerEntry,
} from "../lib/quiz";
import { getSupabaseClient } from "../lib/supabase";
import { splitTime } from "../lib/quiz-timer";
import type { PlayerQuestion } from "../types/quiz";

interface AttemptAnswerLike {
  question_id: string;
  selected_option: number;
  is_correct: boolean;
}

interface AttemptEntry {
  id: string;
  quizId: string;
  quizTitle: string | null;
  score: number;
  total: number;
  finishedAt: string | null;
  timeTakenSeconds: number | null;
  isLocal: boolean;
  answers: AttemptAnswerLike[];
}

function mapDbAttempt(row: {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  finished_at: string | null;
  time_taken_seconds: number | null;
  answers: AttemptAnswerLike[] | null;
  quizzes?: { title?: string | null } | null;
}): AttemptEntry {
  return {
    id: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quizzes?.title ?? null,
    score: row.score ?? 0,
    total: row.total_questions ?? 0,
    finishedAt: row.finished_at,
    timeTakenSeconds: row.time_taken_seconds,
    isLocal: false,
    answers: Array.isArray(row.answers) ? row.answers : [],
  };
}

function mapLocalEntry(quizId: string, result: {
  score?: number;
  total?: number;
  finishedAt?: string;
  title?: string;
  timeTakenSeconds?: number | null;
  answers?: GuestAnswerEntry[];
}): AttemptEntry {
  return {
    id: `local_${quizId}`,
    quizId,
    quizTitle: result.title ?? null,
    score: result.score ?? 0,
    total: result.total ?? 0,
    finishedAt: result.finishedAt ?? null,
    timeTakenSeconds: result.timeTakenSeconds ?? null,
    isLocal: true,
    answers: (result.answers ?? []).map((a) => ({
      question_id: a.questionId,
      selected_option: a.selected,
      is_correct: a.isCorrect,
    })),
  };
}

async function fetchDbAttempts(
  supabase: SupabaseClient,
  userId: string,
): Promise<AttemptEntry[]> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(
      "id, quiz_id, score, total_questions, finished_at, time_taken_seconds, answers, quizzes(title)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as unknown as Parameters<typeof mapDbAttempt>[0][]).map(mapDbAttempt);
}

/** Merge DB + local attempts, dedup by id (DB wins), newest first. */
export function mergeAttempts(db: AttemptEntry[], local: AttemptEntry[]): AttemptEntry[] {
  const byId = new Map<string, AttemptEntry>();
  for (const entry of [...db, ...local]) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => {
    const aMs = a.finishedAt ? Date.parse(a.finishedAt) : 0;
    const bMs = b.finishedAt ? Date.parse(b.finishedAt) : 0;
    return bMs - aMs;
  });
}

interface AttemptReview {
  loading: boolean;
  error: string | null;
  questions: PlayerQuestion[];
}

export default function QuizAttemptsScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [review, setReview] = useState<AttemptReview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const localEntries = await listGuestResults().then((entries) =>
        entries.map((e) => mapLocalEntry(e.quizId, e.result)),
      );
      const dbEntries =
        user && getSupabaseClient
          ? await fetchDbAttempts(getSupabaseClient(), user.id)
          : [];
      setAttempts(mergeAttempts(dbEntries, localEntries));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleExpand = (attempt: AttemptEntry) => {
    if (expandedId === attempt.id) {
      setExpandedId(null);
      setReview(null);
      return;
    }
    setExpandedId(attempt.id);
    setReview({ loading: true, error: null, questions: [] });
    void (async () => {
      try {
        const quiz = await fetchQuizWithQuestions(getSupabaseClient(), attempt.quizId);
        setReview({ loading: false, error: null, questions: quiz.questions });
      } catch (e) {
        setReview({
          loading: false,
          error: e instanceof Error ? e.message : String(e),
          questions: [],
        });
      }
    })();
  };

  const formatTime = (seconds: number | null): string | null => {
    if (seconds == null) return null;
    const { minutes, seconds: secs } = splitTime(seconds);
    return t("quizAttempts", "timeTakenValue", { minutes, seconds });
  };

  const renderReview = (attempt: AttemptEntry) => {
    if (!review) return null;
    if (review.loading) {
      return <ActivityIndicator color={colors.primary} style={styles.reviewLoading} />;
    }
    if (review.error) {
      return <Text style={styles.reviewError}>{review.error}</Text>;
    }
    const byQuestionId = new Map(
      attempt.answers.map((a) => [a.question_id, a] as const),
    );
    return (
      <View style={styles.review}>
        <Text style={[styles.reviewHeading, isRTL && styles.rtlText]}>
          {t("quizAttempts", "answersLabel")}
        </Text>
        {review.questions.map((question, index) => {
          const answer = byQuestionId.get(question.id);
          const selected = answer?.selected_option ?? -1;
          const answered = selected >= 0 && selected < question.options.length;
          return (
            <View key={question.id} style={styles.reviewQuestion}>
              <Text style={[styles.reviewQuestionIndex, isRTL && styles.rtlText]}>
                {t("quizAttempts", "questionIndex", { number: index + 1 })}
              </Text>
              <MathText text={question.question} rtl={locale === "ar"} />
              {question.options.map((option, optionIndex) => {
                const isSelected = answered && selected === optionIndex;
                const isCorrectOption = optionIndex === question.correctAnswer;
                const style =
                  isSelected && isCorrectOption
                    ? styles.reviewOptionCorrect
                    : isSelected && !isCorrectOption
                      ? styles.reviewOptionWrong
                      : isCorrectOption
                        ? styles.reviewOptionCorrectKey
                        : null;
                return (
                  <View key={`${question.id}:${optionIndex}`} style={[styles.reviewOption, style]}>
                    <Text style={[styles.reviewOptionText, isRTL && styles.rtlText]}>
                      {option}
                    </Text>
                  </View>
                );
              })}
              {!answered ? (
                <Text style={[styles.reviewUnsolved, isRTL && styles.rtlText]}>
                  {t("quizAttempts", "unsolvedQuestionsLabel")}
                </Text>
              ) : null}
              {question.explanation ? (
                <View style={styles.reviewExplanation}>
                  <Text style={[styles.reviewExplanationLabel, isRTL && styles.rtlText]}>
                    {t("quizAttempts", "explanationLabel")}
                  </Text>
                  <MathText text={question.explanation} rtl={locale === "ar"} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  };

  const renderAttempt = ({ item }: { item: AttemptEntry }) => {
    const expanded = expandedId === item.id;
    const time = formatTime(item.timeTakenSeconds);
    return (
      <View style={styles.card}>
        <Pressable
          style={({ pressed }) => [styles.attemptHeader, pressed && styles.attemptPressed]}
          onPress={() => toggleExpand(item)}
        >
          <View style={styles.attemptMain}>
            <Text style={[styles.attemptTitle, isRTL && styles.rtlText]} numberOfLines={1}>
              {item.quizTitle ?? t("quizAttempts", "defaultQuizTitle")}
            </Text>
            <View style={styles.attemptMetaRow}>
              {item.isLocal ? (
                <View style={styles.localChip}>
                  <Text style={styles.localChipText}>{t("quizAttempts", "localTag")}</Text>
                </View>
              ) : null}
              {item.finishedAt ? (
                <Text style={styles.attemptDate}>
                  {new Date(item.finishedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                </Text>
              ) : null}
              {time ? <Text style={styles.attemptDate}>{time}</Text> : null}
            </View>
          </View>
          <Text style={[styles.attemptScore, item.score / Math.max(item.total, 1) >= 0.5 ? styles.attemptScoreOk : styles.attemptScoreLow]}>
            {item.score} / {item.total}
          </Text>
        </Pressable>
        {expanded ? renderReview(item) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>{locale === "ar" ? ">" : "<"}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t("quizAttempts", "pageTitle")}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryButtonText}>{t("mobile", "common.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={attempts}
          keyExtractor={(item) => item.id}
          renderItem={renderAttempt}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, isRTL && styles.rtlText]}>
              {t("quizAttempts", "noAttemptsFound")}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backText: { fontSize: 22, fontWeight: "700", color: colors.ink, paddingHorizontal: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.ink },
  list: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  attemptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  attemptPressed: { opacity: 0.7 },
  attemptMain: { flex: 1 },
  attemptTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  attemptMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  localChip: {
    borderRadius: 6,
    backgroundColor: colors.accentBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  localChipText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  attemptDate: { color: colors.subtle, fontSize: 12 },
  attemptScore: { fontSize: 16, fontWeight: "800" },
  attemptScoreOk: { color: colors.success },
  attemptScoreLow: { color: colors.danger },
  review: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  reviewLoading: { marginVertical: 12 },
  reviewError: { color: colors.danger, fontSize: 13, marginTop: 8 },
  reviewHeading: { fontSize: 13, fontWeight: "700", color: colors.subtle, marginBottom: 6 },
  reviewQuestion: { marginBottom: 14 },
  reviewQuestionIndex: { fontSize: 12, fontWeight: "700", color: colors.subtle, marginBottom: 4 },
  reviewOption: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  reviewOptionCorrect: { borderColor: colors.success, backgroundColor: colors.successBg },
  reviewOptionWrong: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  reviewOptionCorrectKey: { borderColor: colors.primary, backgroundColor: colors.accentBg },
  reviewOptionText: { color: colors.ink, fontSize: 13 },
  reviewUnsolved: { color: colors.subtle, fontSize: 12, marginTop: 6 },
  reviewExplanation: { marginTop: 8 },
  reviewExplanationLabel: { fontSize: 12, fontWeight: "700", color: colors.subtle, marginBottom: 2 },
  empty: { color: colors.subtle, textAlign: "center", paddingVertical: 32 },
  errorText: { color: colors.danger, marginBottom: 12, textAlign: "center" },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: { color: colors.onPrimary, fontWeight: "700" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
});
