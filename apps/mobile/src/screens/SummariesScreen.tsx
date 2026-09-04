/**
 * Summaries tab: reads the same `summaries_with_ratings` view the web
 * app uses (top-rated first, limit 50), shares a card through the
 * native share sheet (src/share.ts) and opens the summary PDF with
 * Linking. Offline reads come from the LocalReadCache through
 * useSupabaseQuery, with the offline banner on top.
 */
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SupabaseClient } from "masarx-shared/supabase";

import { useI18n } from "../context/I18nContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSupabaseQuery } from "../hooks/useSupabaseQuery";
import { shareStudyContent } from "../share";

interface SummaryRow {
  id: string;
  title: string;
  content: string | null;
  pdf_url: string | null;
  avg_rating: number | null;
  ratings_count: number | null;
}

const COLORS = {
  primary: "#4F46E5",
  ink: "#111827",
  subtle: "#6B7280",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  banner: "#FEF3C7",
  bannerText: "#92400E",
  danger: "#DC2626",
};

async function fetchSummaries(supabase: SupabaseClient): Promise<SummaryRow[]> {
  const { data, error } = await supabase
    .from("summaries_with_ratings")
    .select("*")
    .order("avg_rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as SummaryRow[];
}

export default function SummariesScreen() {
  const { t } = useI18n();
  const { online } = useNetworkStatus();
  const { data, loading, error, refetch } = useSupabaseQuery<SummaryRow[]>({
    cacheKey: "summaries:top",
    fetcher: fetchSummaries,
  });

  const summaries = data ?? [];

  const onShare = async (row: SummaryRow) => {
    const excerpt = (row.content ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    await shareStudyContent({
      title: row.title,
      url: row.pdf_url,
      excerpt: excerpt || null,
      appName: "Masar X",
    });
  };

  const onOpen = async (row: SummaryRow) => {
    if (!row.pdf_url) return;
    try {
      await Linking.openURL(row.pdf_url);
    } catch {
      // No handler for http(s) links on the device; the share sheet
      // still carries the URL, so this is safe to swallow.
    }
  };

  const renderItem = ({ item }: { item: SummaryRow }) => {
    const excerpt = (item.content ?? "").replace(/\s+/g, " ").trim();
    const rating =
      typeof item.avg_rating === "number" && item.avg_rating > 0
        ? item.avg_rating.toFixed(1)
        : null;
    const count = item.ratings_count ?? 0;
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {rating ? (
          <Text style={styles.rating}>
            * {rating} ({count})
          </Text>
        ) : null}
        {excerpt ? (
          <Text style={styles.excerpt} numberOfLines={3}>
            {excerpt}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable style={styles.chip} onPress={() => void onShare(item)}>
            <Text style={styles.chipText}>Share</Text>
          </Pressable>
          {item.pdf_url ? (
            <Pressable style={[styles.chip, styles.chipPrimary]} onPress={() => void onOpen(item)}>
              <Text style={[styles.chipText, styles.chipTextPrimary]}>Open PDF</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={summaries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{t("mobile", "tabs.summaries")}</Text>
            {!online ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{t("mobile", "offline.banner")}</Text>
              </View>
            ) : null}
          </View>
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refetch}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListFooterComponent={
          error && summaries.length > 0 ? (
            <Text style={styles.footerError}>{t("mobile", "offline.retryWhenOnline")}</Text>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={refetch}>
                <Text style={styles.retryButtonText}>{t("mobile", "common.retry")}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.empty}>{t("summaries", "noSummaries")}</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  list: { padding: 16, paddingBottom: 32 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.ink,
    marginBottom: 12,
  },
  banner: {
    backgroundColor: COLORS.banner,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  bannerText: { color: COLORS.bannerText, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: COLORS.ink },
  rating: { fontSize: 13, color: COLORS.subtle, marginTop: 4 },
  excerpt: { fontSize: 14, color: COLORS.subtle, marginTop: 8, lineHeight: 20 },
  actions: { flexDirection: "row", marginTop: 12 },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipPrimary: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.ink, fontWeight: "600", fontSize: 13 },
  chipTextPrimary: { color: "#FFFFFF" },
  center: { alignItems: "center", paddingVertical: 32 },
  empty: { color: COLORS.subtle, textAlign: "center" },
  error: { color: COLORS.danger, marginBottom: 12, textAlign: "center" },
  footerError: {
    color: COLORS.subtle,
    textAlign: "center",
    paddingVertical: 10,
    fontSize: 12,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: { color: "#FFFFFF", fontWeight: "700" },
});