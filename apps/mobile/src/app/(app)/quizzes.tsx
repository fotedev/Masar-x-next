import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { fetchApprovedQuizzes } from "@/lib/api";
import { palette, Card, Chip, EmptyState, ErrorState, ListSkeleton } from "@/components/bits";

type QuizRow = {
  id: string;
  title: string;
  description?: string | null;
  created_at?: string | null;
  duration_seconds?: number | null;
  // description stores a JSON string {description, department, year, subject}
  [key: string]: unknown;
};

function parseDescription(raw?: string | null): { description?: string; department?: string; year?: string; subject?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return { description: raw };
  } catch {
    return { description: raw };
  }
}

export default function QuizzesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const query = useQuery({
    queryKey: ["quizzes"],
    queryFn: fetchApprovedQuizzes,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const rows = query.data ?? [];

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} tintColor="#2563eb" />}
    >
      {query.isError ? (
        <ErrorState message="تعذّر تحميل الاختبارات" onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد اختبارات متاحة بعد" />
      ) : (
        rows.map((q) => {
          const meta = parseDescription(q.description);
          return (
            <Card key={q.id}>
              <Pressable
                onPress={() => router.push(`/(app)/quiz-play/${q.id}`)}
                hitSlop={4}
                android_ripple={{ color: "#e5edff" }}
                accessibilityRole="button"
                accessibilityLabel={q.title}
              >
                <View style={styles.headRow}>
                  <Text style={styles.title} numberOfLines={2}>
                    {q.title}
                  </Text>
                  {typeof q.duration_seconds === "number" && q.duration_seconds > 0 ? (
                    <Chip text={`${Math.round(q.duration_seconds / 60)} د`} />
                  ) : null}
                </View>
                {meta.description ? (
                  <Text style={styles.description} numberOfLines={2}>
                    {meta.description}
                  </Text>
                ) : null}
                <View style={styles.chipsRow}>
                  {meta.subject ? <Chip text={meta.subject} /> : null}
                  {meta.year ? <Chip text={meta.year} /> : null}
                </View>
              </Pressable>
            </Card>
          );
        })
      )}
      {!query.isError && !query.isLoading && rows.length > 0 ? (
        <Text style={styles.footer}>اضغط على أي اختبار لبدء المحاولة — النتائج تُحفظ لحسابك</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 24 },
  headRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: palette.text },
  description: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: 8 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  footer: { color: palette.textMuted, fontSize: 12, textAlign: "center", marginTop: 4 },
});
