import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useAuth } from "@/lib/auth";
import { fetchSubjects, fetchPlatformSettings } from "@/lib/api";
import { palette, Card, Chip, EmptyState, ErrorState, ListSkeleton } from "@/components/bits";

export default function SubjectsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Same inputs the web uses: the user's level (from profile/onboarding) and
  // the active semester from platform_settings.
  const settings = useQuery({ queryKey: ["platform-settings"], queryFn: fetchPlatformSettings });
  const subjects = useQuery({
    queryKey: ["subjects", { level: profile?.level ?? null, semester: settings.data?.activeSemester ?? null }],
    queryFn: () =>
      fetchSubjects({
        level: typeof profile?.level === "number" ? profile.level : null,
        semester: settings.data?.activeSemester ?? null,
      }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([subjects.refetch(), settings.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const rows = subjects.data ?? [];

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} tintColor="#2563eb" />}
    >
      {subjects.isError ? (
        <ErrorState message="تعذّر تحميل المواد" onRetry={() => subjects.refetch()} />
      ) : subjects.isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="لا توجد مواد لهذا الفصل"
          subtitle="حدّد مستواك وفصلك من شاشة حسابي، أو تحقق لاحقًا"
        />
      ) : (
        rows.map((s) => (
          <Card key={s.id}>
            <Pressable
              onPress={() => router.push(`/(app)/subjects/${encodeURIComponent(s.name)}`)}
              hitSlop={4}
              android_ripple={{ color: "#e5edff" }}
              accessibilityRole="button"
              accessibilityLabel={s.name}
            >
              <View style={styles.headRow}>
                <Text style={styles.name} numberOfLines={2}>
                  {s.name}
                </Text>
                {typeof s.level === "number" ? <Chip text={`المستوى ${s.level}`} /> : null}
              </View>
              {s.professor ? <Text style={styles.professor}>د. {s.professor}</Text> : null}
              {s.description ? (
                <Text style={styles.description} numberOfLines={3}>
                  {s.description}
                </Text>
              ) : null}
            </Pressable>
          </Card>
        ))
      )}
      {!subjects.isError && !subjects.isLoading && rows.length > 0 ? (
        <Text style={styles.footer}>اضغط على أي مادة لعرض المحاضرات والمحتوى</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 24 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: "700", color: palette.text },
  professor: { color: palette.textMuted, fontSize: 13, marginTop: 4 },
  description: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: 8 },
  footer: { color: palette.textMuted, fontSize: 12, textAlign: "center", marginTop: 4 },
});
