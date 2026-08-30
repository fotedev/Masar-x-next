import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";

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

function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

export default function SummariesScreen() {
  const [refreshing, setRefreshing] = useState(false);
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

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.list}
      data={query.data ?? []}
      keyExtractor={(item, index) => String(item.id ?? index)}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await query.refetch();
        } finally {
          setRefreshing(false);
        }
      }}
      renderItem={({ item }) => (
        <Card>
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
          {item.created_at ? <Text style={styles.date}>{formatDate(item.created_at)}</Text> : null}
        </Card>
      )}
      ListHeaderComponent={
        query.isError ? (
          <ErrorState message="تعذّر تحميل الملخصات" onRetry={() => query.refetch()} />
        ) : !query.isLoading && (query.data ?? []).length === 0 ? (
          <EmptyState title="لا توجد ملخصات بعد" />
        ) : null
      }
      ListEmptyComponent={query.isLoading ? <ListSkeleton rows={5} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
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
  date: { color: palette.textMuted, fontSize: 12, marginTop: 8 },
});
