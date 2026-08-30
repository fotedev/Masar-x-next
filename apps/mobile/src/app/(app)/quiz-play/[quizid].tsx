import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { fetchQuizQuestions } from "@/lib/api";
import { palette, Card, EmptyState, ErrorState, ListSkeleton, PrimaryButton } from "@/components/bits";

// Quiz player mirroring the web QuizPlayer contract (lib/quiz.ts):
// startAttempt → saveAnswer (upsert per question) → finishAttempt.
// Guests play locally (no attempt rows).

type Attempt = { id: string; started_at: string } | null;

export default function QuizPlayScreen() {
  const { quizId } = useLocalSearchParams<{ quizId: string }>();
  const queryClient = useQueryClient();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attempt, setAttempt] = useState<Attempt>(null);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const questions = useQuery({
    queryKey: ["quiz-questions", quizId],
    queryFn: () => fetchQuizQuestions(String(quizId)),
    enabled: started,
  });
  const rows = questions.data ?? [];
  const total = rows.length;
  const score = useMemo(
    () => rows.filter((q) => answers[q.id] === q.correct_answer).length,
    [rows, answers],
  );

  useEffect(() => {
    if (!started || finished) return;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, finished]);

  const start = async () => {
    setStarted(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return; // guests: local play only
    try {
      const { data: existing } = await supabase
        .from("quiz_attempts")
        .select("id, started_at")
        .eq("quiz_id", String(quizId))
        .eq("user_id", userId)
        .is("finished_at", null)
        .limit(1)
        .maybeSingle();
      if (existing) {
        setAttempt(existing as Attempt);
        const { data: savedAnswers } = await supabase
          .from("quiz_answers")
          .select("question_id, selected_option")
          .eq("attempt_id", existing.id);
        const restored: Record<string, number> = {};
        for (const a of savedAnswers ?? []) restored[a.question_id] = a.selected_option;
        setAnswers(restored);
      } else {
        const { data: created, error } = await supabase
          .from("quiz_attempts")
          .insert({ quiz_id: String(quizId), user_id: userId, score: 0, total_questions: 0, started_at: new Date().toISOString() })
          .select("id, started_at")
          .maybeSingle();
        if (!error && created) setAttempt(created as Attempt);
      }
    } catch {
      // Local play continues even if attempt persistence fails.
    }
  };

  const saveAnswer = async (questionId: string, selectedOption: number, isCorrect: boolean) => {
    setAnswers((prev) => ({ ...prev, [questionId]: selectedOption }));
    if (!attempt) return; // guests
    try {
      await supabase.from("quiz_answers").upsert(
        { attempt_id: attempt.id, question_id: questionId, selected_option: selectedOption, is_correct: isCorrect },
        { onConflict: "attempt_id,question_id" },
      );
    } catch {
      // keep local state; attempt backup happens on finish
    }
  };

  const finish = async () => {
    setFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (!attempt) return;
    try {
      await supabase
        .from("quiz_attempts")
        .update({
          score,
          total_questions: total,
          finished_at: new Date().toISOString(),
          answers,
        })
        .eq("id", attempt.id);
      queryClient.invalidateQueries({ queryKey: ["quiz-attempts"] });
    } catch {
      // results are still shown locally
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!started) {
    return (
      <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={styles.centerWrap}>
        <Card>
          <Text style={styles.readyTitle}>جاهز لبدء الاختبار؟</Text>
          <Text style={styles.readyText}>
            أجب على الأسئلة بالترتيب، ويمكنك التنقل بين الأسئلة قبل الإنهاء. إذا سجّلت الدخول فسيتم حفظ محاولتك تلقائيًا.
          </Text>
          <PrimaryButton label="ابدأ الاختبار" onPress={() => void start()} />
        </Card>
      </ScrollView>
    );
  }

  if (questions.isError) return <ErrorState message="تعذّر تحميل أسئلة الاختبار" onRetry={() => questions.refetch()} />;
  if (questions.isLoading) return <ListSkeleton rows={4} />;
  if (total === 0) return <EmptyState title="لا توجد أسئلة في هذا الاختبار" />;

  if (finished) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={styles.centerWrap}>
        <Card style={{ alignItems: "center" }}>
          <Text style={styles.scoreBig}>{pct}%</Text>
          <Text style={styles.scoreLine}>
            {score} إجابة صحيحة من {total}
          </Text>
          <Text style={styles.scoreMeta}>الوقت: {fmtTime(elapsed)}</Text>
        </Card>
        {rows.map((q, i) => {
          const selected = answers[q.id];
          const correct = selected === q.correct_answer;
          return (
            <Card key={q.id}>
              <Text style={styles.reviewQ}>
                {i + 1}. {q.question}
              </Text>
              <Text style={{ color: correct ? "#16a34a" : palette.danger, fontSize: 13, marginTop: 4 }}>
                {correct ? "✓ صحيحة" : `✗ إجابتك: ${q.options[selected] ?? "لم تجب"}`}
              </Text>
              {!correct ? <Text style={styles.reviewCorrect}>الصحيحة: {q.options[q.correct_answer]}</Text> : null}
              {q.explanation ? <Text style={styles.reviewExpl}>{q.explanation}</Text> : null}
            </Card>
          );
        })}
      </ScrollView>
    );
  }

  const q = rows[index];
  const selected = answers[q.id];
  const isLast = index === total - 1;

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={styles.container}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          سؤال {index + 1} من {total}
        </Text>
        <Text style={styles.timer}>⏱ {fmtTime(elapsed)}</Text>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
      </View>

      <Card>
        <Text style={styles.question}>{q.question}</Text>
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          return (
            <Pressable
              key={i}
              onPress={() => void saveAnswer(q.id, i, i === q.correct_answer)}
              className={`mb-2 rounded-xl border px-3.5 py-3 ${isSelected ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}
              accessibilityRole="button"
              accessibilityLabel={`خيار ${i + 1}`}
            >
              <Text style={{ color: isSelected ? palette.primaryDark : palette.text, fontSize: 15 }}>{opt}</Text>
            </Pressable>
          );
        })}
      </Card>

      <View style={styles.navRow}>
        <PrimaryButton
          label="السابق"
          variant="ghost"
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        />
        {isLast ? (
          <PrimaryButton
            label="إنهاء وعرض النتيجة"
            onPress={() => {
              if (Object.keys(answers).length < total) {
                Alert.alert("تنبيه", `أجبت على ${Object.keys(answers).length} من ${total} — هل تريد الإنهاء؟`, [
                  { text: "متابعة الحل", style: "cancel" },
                  { text: "إنهاء", onPress: () => void finish() },
                ]);
              } else {
                void finish();
              }
            }}
          />
        ) : (
          <PrimaryButton label="التالي" onPress={() => setIndex((i) => Math.min(total - 1, i + 1))} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerWrap: { padding: 16, paddingTop: 24 },
  container: { padding: 16, paddingBottom: 24 },
  readyTitle: { fontSize: 18, fontWeight: "800", color: palette.text, marginBottom: 8 },
  readyText: { fontSize: 14, lineHeight: 22, color: palette.textMuted, marginBottom: 16 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  progressText: { fontSize: 13, color: palette.textMuted },
  timer: { fontSize: 13, fontWeight: "700", color: palette.text },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: "#e2e8f0", marginBottom: 14, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: palette.primary },
  question: { fontSize: 17, fontWeight: "700", color: palette.text, lineHeight: 26, marginBottom: 12 },
  navRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  scoreBig: { fontSize: 44, fontWeight: "900", color: palette.primary },
  scoreLine: { fontSize: 16, color: palette.text, marginTop: 4 },
  scoreMeta: { fontSize: 13, color: palette.textMuted, marginTop: 4 },
  reviewQ: { fontSize: 14, fontWeight: "700", color: palette.text, lineHeight: 22 },
  reviewCorrect: { color: "#16a34a", fontSize: 13, marginTop: 4 },
  reviewExpl: { color: palette.textMuted, fontSize: 13, lineHeight: 20, marginTop: 6 },
});
