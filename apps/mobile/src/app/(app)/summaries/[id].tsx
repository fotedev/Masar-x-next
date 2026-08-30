import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchSummaryById, fetchProfileById } from "@/lib/api";
import { palette, Card, Chip, EmptyState, ErrorState, ListSkeleton } from "@/components/bits";

function stripImageMarkers(content: string): string {
  // The web parses an [IMAGES:[...]] marker for inline images; on mobile v1
  // we render the text content and hide the marker block.
  return content.replace(/\[IMAGES:\[[^\]]*\]\]/g, "").trim();
}

export default function SummaryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = useQuery({
    queryKey: ["summary", id],
    queryFn: () => fetchSummaryById(String(id)),
  });
  const author = useQuery({
    queryKey: ["summary-author", summary.data?.user_id],
    queryFn: () => fetchProfileById(summary.data!.user_id),
    enabled: Boolean(summary.data?.user_id),
  });

  if (summary.isError) return <ErrorState message="تعذّر تحميل الملخص" onRetry={() => summary.refetch()} />;
  if (summary.isLoading) return <ListSkeleton rows={4} />;
  if (!summary.data) return <EmptyState title="الملخص غير متاح" subtitle="قد يكون قيد المراجعة أو محذوفًا" />;

  const s = summary.data;
  const body = stripImageMarkers(s.content ?? "");

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={styles.container}>
      <Card>
        <Text style={styles.title}>{s.title}</Text>
        <View style={styles.metaRow}>
          {s.subject ? <Chip text={s.subject} /> : null}
          {s.year ? <Chip text={String(s.year)} /> : null}
          {s.department ? <Chip text={s.department} /> : null}
        </View>
        {author.data?.full_name ? <Text style={styles.author}>إعداد: {author.data.full_name}</Text> : null}
      </Card>

      {s.pdf_url ? (
        <Card>
          <Pressable
            onPress={() => void Linking.openURL(s.pdf_url as string)}
            className="items-center rounded-xl bg-blue-600 py-3 active:opacity-85"
            accessibilityRole="button"
            accessibilityLabel="تحميل الملخص PDF"
          >
            <Text className="font-semibold text-white">⬇️ تحميل الملخص PDF</Text>
          </Pressable>
        </Card>
      ) : null}

      {s.youtube_url ? (
        <Card>
          <Pressable
            onPress={() => void Linking.openURL(s.youtube_url as string)}
            className="items-center rounded-xl bg-red-600 py-3 active:opacity-85"
            accessibilityRole="button"
            accessibilityLabel="فتح الشرح على يوتيوب"
          >
            <Text className="font-semibold text-white">▶️ مشاهدة الشرح على يوتيوب</Text>
          </Pressable>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.bodyLabel}>المحتوى</Text>
        <Text style={styles.body}>{body || "لا يوجد محتوى نصي في هذا الملخص."}</Text>
      </Card>

      {s.updated_at ? <Text style={styles.footer}>آخر تحديث: {new Date(s.updated_at).toLocaleDateString("ar-EG")}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: "800", color: palette.text, lineHeight: 30 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  author: { color: palette.textMuted, fontSize: 13, marginTop: 10 },
  bodyLabel: { fontSize: 15, fontWeight: "700", color: palette.text, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 26, color: palette.text },
  footer: { color: palette.textMuted, fontSize: 12, textAlign: "center" },
});
