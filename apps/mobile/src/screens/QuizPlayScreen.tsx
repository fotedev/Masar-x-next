/**
 * Quiz player (spec US2 / US4): loads quiz + questions via
 * src/lib/quiz.ts (same Supabase tables as the web app), records each
 * answer, and on finish:
 *
 *   - signed in  -> startAttempt + saveAnswer + finishAttempt rows in
 *     quiz_attempts / quiz_answers (cross-device parity with web),
 *   - guest      -> result kept on-device only via saveGuestResult.
 *
 * Ends on a score screen with the save outcome (server vs on-device).
 */
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "../../app/App";
import MathText from "../components/MathText";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  fetchQuizWithQuestions,
  finishAttempt,
  saveAnswer,
  saveGuestResult,
  startAttempt,
} from "../lib/quiz";
import { getSupabaseClient } from "../lib/supabase";
import type { PlayerQuestion } from "../types/quiz";

interface LoadedQuiz {
  title: string;
  description: string | null;
  questions: PlayerQuestion[];
}

type Phase = "loading" | "error" | "playing" | "finished";

interface FinishResult {
  score: number;
  total: number;
  savedToServer: boolean;
}

const COLORS = {
  primary: "#4F46E5",
  ink: "#111827",
  subtle: "#6B7280",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  danger: "#DC2626",
  success: "#16A34A",
};

export default function QuizPlayScreen() {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = (route.params ?? {}) as { quizId?: string; title?: string };
  const quizId = params.quizId ?? "";

  const { user } = useAuth();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<LoadedQuiz | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // getSupabaseClient() throws only when the app was built without the
  // env vars; the auth gate keeps this screen behind a configured app.
  const supabaseRef = useRef<ReturnType<typeof getSupabaseClient> | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = getSupabaseClient();
    return supabaseRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setLoadError(null);
    (async () => {
      try {
        const loaded = await fetchQuizWithQuestions(getSupabase(), quizId);
        if (cancelled) return;
        setQuiz(loaded);
        setAnswers(new Array(loaded.questions.length).fill(null));
        setIndex(0);
        setPhase("playing");
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, getSupabase, reloadToken]);

  const total = quiz?.questions.length ?? 0;
  const question = quiz?.questions[index] ?? null;
  const selected = answers[index] ?? null;

  const choose = (optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = optionIndex;
      return next;
    });
  };

  const goPrev = () => {
    if (index > 0) setIndex(index - 1);
  };

  const goNext = () => {
    if (index < total - 1) setIndex(index + 1);
  };

  const finish = async () => {
    if (!quiz || submitting) return;
    const questions = quiz.questions;
    const finalScore = questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0),
      0,
    );
    setSubmitting(true);
    let savedToServer = false;
    try {
      if (user) {
        const attempt = await startAttempt(getSupabase(), quizId, user.id);
        for (let i = 0; i < questions.length; i += 1) {
          const choice = answers[i];
          if (choice === null || choice === undefined) continue;
          await saveAnswer(
            getSupabase(),
            attempt.id,
            questions[i].id,
            choice,
            choice === questions[i].correctAnswer,
          );
        }
        await finishAttempt(getSupabase(), attempt.id, finalScore, questions.length);
        savedToServer = true;
      } else {
        await saveGuestResult(quizId, {
          quizId,
          score: finalScore,
          total: questions.length,
          finishedAt: new Date().toISOString(),
        });
      }
    } catch {
      savedToServer = false;
    } finally {
      setResult({ score: finalScore, total: questions.length, savedToServer });
      setSubmitting(false);
      setPhase("finished");
    }
  };

  if (phase === "loading") {
    return (
      <SafeAreaView style={[styles.screen, styles.center]} edges={["top", "left", "right"]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.preparing}>{t("quizzes", "preparing")}</Text>
      </SafeAreaView>
    );
  }

  if (phase === "error" || !quiz) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]} edges={["top", "left", "right"]}>
        <Text style={styles.errorText}>{loadError ?? t("quizzes", "failed")}</Text>
        <Pressable style={styles.button} onPress={() => setReloadToken((n) => n + 1)}>
          <Text style={styles.buttonText}>{t("quizzes", "retry")}</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>{t("quizzes", "backToHome")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === "finished" && result) {
    const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    const praiseKey = pct >= 90 ? "amazing" : pct >= 70 ? "excellent" : "goodJob";
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={[styles.center, { flexGrow: 1, padding: 24 }]}>
          <Text style={styles.doneTitle}>{t("quizzes", "completed")}</Text>
          <Text style={styles.scoreText}>
            {result.score} / {result.total}
          </Text>
          <Text style={styles.praise}>{t("quizzes", praiseKey)}</Text>
          <Text
            style={[
              styles.saveNote,
              result.savedToServer ? styles.saveOk : styles.saveOffline,
            ]}
          >
            {result.savedToServer ? t("quizzes", "saved") : t("mobile", "quiz.savingOffline")}
          </Text>
          <Pressable style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>{t("quizzes", "backToHome")}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isLast = index === total - 1;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <View style={[styles.header, { paddingTop: 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>{locale === "ar" ? ">" : "<"}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {quiz.title || params.title || "Masar X"}
        </Text>
        {user ? null : (
          <View style={styles.guestChip}>
            <Text style={styles.guestChipText}>{t("mobile", "quiz.guestMode")}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.progress}>
          {index + 1} / {total}
        </Text>
        {question ? (
          <>
            <View style={styles.questionCard}>
              <Text style={styles.questionIndex}>
                {t("quizzes", "question")} {index + 1}
              </Text>
              <MathText text={question.question} rtl={locale === "ar"} />
            </View>

            {question.options.map((option, optionIndex) => {
              const active = selected === optionIndex;
              return (
                <Pressable
                  key={`${question.id}:${optionIndex}`}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => choose(optionIndex)}
                >
                  <View style={[styles.optionDot, active && styles.optionDotActive]} />
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}

            {question.explanation && selected !== null ? (
              <Text style={styles.explanation}>{question.explanation}</Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.footerButton, index === 0 && styles.footerButtonDisabled]}
          onPress={goPrev}
          disabled={index === 0}
        >
          <Text style={styles.footerButtonText}>{t("quizzes", "previous")}</Text>
        </Pressable>
        {isLast ? (
          <Pressable
            style={[styles.footerButton, styles.footerButtonPrimary, submitting && styles.footerButtonDisabled]}
            onPress={() => void finish()}
            disabled={submitting || selected === null}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.footerButtonText, styles.footerButtonTextPrimary]}>
                {t("quizzes", "confirmAnswer")}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.footerButton, styles.footerButtonPrimary]}
            onPress={goNext}
            disabled={selected === null}
          >
            <Text style={[styles.footerButtonText, styles.footerButtonTextPrimary]}>
              {t("quizzes", "nextQuestion")}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: "center", justifyContent: "center" },
  preparing: { color: COLORS.subtle, marginTop: 12 },
  errorText: { color: COLORS.danger, textAlign: "center", marginBottom: 16, paddingHorizontal: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  backText: { fontSize: 22, fontWeight: "700", color: COLORS.ink, paddingHorizontal: 8 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: COLORS.ink, paddingHorizontal: 8 },
  guestChip: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  guestChipText: { color: "#92400E", fontSize: 11, fontWeight: "700" },
  list: { padding: 16, paddingBottom: 24 },
  progress: { color: COLORS.subtle, fontWeight: "600", marginBottom: 10 },
  questionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  questionIndex: { color: COLORS.subtle, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  optionActive: { borderColor: COLORS.primary, backgroundColor: "#EEF2FF" },
  optionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.subtle,
    marginRight: 10,
  },
  optionDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  optionText: { flex: 1, color: COLORS.ink, fontSize: 15 },
  optionTextActive: { fontWeight: "700" },
  explanation: { color: COLORS.subtle, fontSize: 13, marginTop: 4, lineHeight: 19 },
  footer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  footerButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  footerButtonPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  footerButtonDisabled: { opacity: 0.5 },
  footerButtonText: { color: COLORS.ink, fontWeight: "700" },
  footerButtonTextPrimary: { color: "#FFFFFF" },
  doneTitle: { fontSize: 22, fontWeight: "800", color: COLORS.ink, marginBottom: 8 },
  scoreText: { fontSize: 40, fontWeight: "800", color: COLORS.primary, marginBottom: 8 },
  praise: { color: COLORS.subtle, marginBottom: 12 },
  saveNote: { fontSize: 13, marginBottom: 20 },
  saveOk: { color: COLORS.success },
  saveOffline: { color: COLORS.subtle },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 8,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  linkButton: { paddingVertical: 8 },
  linkText: { color: COLORS.primary, fontWeight: "600" },
});