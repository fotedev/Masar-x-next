import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { supabase } from "@/lib/supabase";
import { palette, Card, EmptyState, ErrorState, ListSkeleton } from "@/components/bits";

type Summary = {
  id: string;
  title?: string | null;
  subject_name?: string | null;
  avg_rating?: number | null;
  ratings_count?: number | null;
  downloads?: number | null;
  created_at?: string | null;
  description?: string | null;
};

export default function SummariesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const query = useQuery({
    queryKey: ["summaries"],
    queryFn: async () => {
      // Same ranked view the web app uses (summaries ordered by average rating).
      const { data, error } = await supabase
        .from("summaries_with_ratings")
        .select("*")
        .order("avg_rating", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Summary[];
    },
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
        <ErrorState message="تعذّر تحميل الملخصات" onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد ملخصات بعد" />
      ) : (
        rows.map((item) => (
          <Card key={String(item.id)}>
            <Pressable
              onPress={() => router.push(`/(app)/summaries/${item.id}`)}
              hitSlop={4}
              android_ripple={{ color: "#e5edff" }}
              accessibilityRole="button"
              accessibilityLabel={item.title ?? "ملخص"}
            >
              <View style={styles.headRow}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title ?? "ملخص"}
                </Text>
                {typeof item.avg_rating === "number" ? (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>★ {item.avg_rating.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>
              {item.subject_name ? <Text style={styles.subject}>{item.subject_name}</Text> : null}
              {item.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </Pressable>
          </Card>
        ))
      )}
      {!query.isError && !query.isLoading && rows.length > 0 ? (
        <Text style={styles.footer}>اضغط على أي ملخص لعرضه كاملًا وتحميله</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 24 },
  headRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: palette.text },
  ratingBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ratingText: { color: "#92400e", fontSize: 12, fontWeight: "700" },
  subject: { color: palette.primaryDark, fontSize: 13, marginTop: 4 },
  description: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: 8 },
  footer: { color: palette.textMuted, fontSize: 12, textAlign: "center", marginTop: 4 },
});
