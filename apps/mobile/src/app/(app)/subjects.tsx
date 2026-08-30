import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { palette, Card, Chip, EmptyState, ErrorState, ListSkeleton } from "@/components/bits";

type Subject = {
  id: string;
  name: string;
  professor?: string | null;
  description?: string | null;
  level?: number | null;
  semester?: number | null;
  is_academic?: boolean | null;
};

export default function SubjectsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const query = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, professor, description, level, semester, is_academic")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.list}
      data={query.data ?? []}
      keyExtractor={(item) => item.id}
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
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            {typeof item.level === "number" ? <Chip text={`المستوى ${item.level}`} /> : null}
          </View>
          {item.professor ? <Text style={styles.professor}>د. {item.professor}</Text> : null}
          {item.description ? (
            <Text style={styles.description} numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}
        </Card>
      )}
      ListHeaderComponent={
        query.isError ? (
          <ErrorState message="تعذّر تحميل المواد" onRetry={() => query.refetch()} />
        ) : !query.isLoading && (query.data ?? []).length === 0 ? (
          <EmptyState title="لا توجد مواد بعد" subtitle="ستظهر مواد تخصصك هنا عند إضافتها" />
        ) : null
      }
      ListEmptyComponent={query.isLoading ? <ListSkeleton rows={5} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  list: { padding: 16, paddingBottom: 24 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: "700", color: palette.text },
  professor: { color: palette.textMuted, fontSize: 13, marginTop: 4 },
  description: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: 8 },
});
