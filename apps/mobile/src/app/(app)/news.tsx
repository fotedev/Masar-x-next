import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { palette, Card, EmptyState, ErrorState, ListSkeleton } from "@/components/bits";

type NewsItem = {
  id: string;
  title?: string | null;
  body?: string | null;
  content?: string | null;
  description?: string | null;
  created_at?: string | null;
  is_active?: boolean | null;
};

function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

export default function NewsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const query = useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NewsItem[];
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
      renderItem={({ item }) => {
        const body = item.body ?? item.content ?? item.description ?? "";
        return (
          <Card>
            <View style={styles.headRow}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title ?? "إعلان"}
              </Text>
              {item.created_at ? <Text style={styles.date}>{formatDate(item.created_at)}</Text> : null}
            </View>
            {body ? (
              <Text style={styles.body} numberOfLines={6}>
                {body}
              </Text>
            ) : null}
          </Card>
        );
      }}
      ListHeaderComponent={
        query.isError ? (
          <ErrorState message="تعذّر تحميل الأخبار" onRetry={() => query.refetch()} />
        ) : !query.isLoading && (query.data ?? []).length === 0 ? (
          <EmptyState title="لا توجد أخبار بعد" />
        ) : null
      }
      ListEmptyComponent={query.isLoading ? <ListSkeleton rows={4} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  list: { padding: 16, paddingBottom: 24 },
  headRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: "700", color: palette.text },
  date: { color: palette.textMuted, fontSize: 12 },
  body: { color: palette.text, fontSize: 14, lineHeight: 22, marginTop: 8 },
});
