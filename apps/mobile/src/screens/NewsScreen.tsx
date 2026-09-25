/**
 * News tab (spec 020 C2/T101): read-only port of the web /news page —
 * active announcements from the same `news` table with the same query
 * shape as web's useNews (is_active = true, created_at desc, limit 30),
 * category chips (all / announcement / update / important; custom-
 * category items surface only under "all", per lib/news-filter), first
 * image inline via RN Image, file attachments opened externally.
 *
 * Admin authoring/editing/appeal surfaces stay web-only (spec 020
 * non-goal). Offline reads come from the LocalReadCache.
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import {
  customCategoryLabel,
  matchesCategory,
  type NewsCategory,
} from "../lib/news-filter";

interface NewsRow {
  id: string;
  title: string;
  content: string | null;
  type: string | null;
  priority: number | null;
  created_at: string;
  file_url: string | null;
  image_urls: string[] | null;
  custom_category: string | null;
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
  chipActiveText: "#FFFFFF",
};

const CATEGORIES: NewsCategory[] = ["all", "announcement", "update", "important"];

async function fetchNews(supabase: SupabaseClient): Promise<NewsRow[]> {
  // Web useNews shape verbatim (spec 020 §2.1).
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as unknown as NewsRow[];
}

export default function NewsScreen() {
  const { t, isRTL, locale } = useI18n();
  const { online } = useNetworkStatus();
  const [category, setCategory] = useState<NewsCategory>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data, loading, error, refetch } = useSupabaseQuery<NewsRow[]>({
    cacheKey: "news:active",
    fetcher: fetchNews,
  });

  const news = useMemo(
    () => (data ?? []).filter((row) => matchesCategory(row, category)),
    [data, category],
  );

  const categoryLabel = (cat: NewsCategory): string => {
    if (cat === "all") return t("news", "categoryAll");
    if (cat === "announcement") return t("news", "categoryAnnouncement");
    if (cat === "update") return t("news", "categoryUpdate");
    return t("news", "categoryImportant");
  };

  const renderItem = ({ item }: { item: NewsRow }) => {
    const expanded = expandedId === item.id;
    const coverImage = item.image_urls && item.image_urls.length > 0 ? item.image_urls[0] : null;
    const customLabel = customCategoryLabel(item);
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => setExpandedId(expanded ? null : item.id)}
      >
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.cover} resizeMode="cover" />
        ) : null}
        <Text style={[styles.cardTitle, isRTL && styles.rtlText]} numberOfLines={expanded ? undefined : 2}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          {customLabel ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText} numberOfLines={1}>
                {customLabel}
              </Text>
            </View>
          ) : null}
          <Text style={styles.metaDate}>
            {new Date(item.created_at).toLocaleDateString(
              locale === "ar" ? "ar-EG" : "en-US",
            )}
          </Text>
        </View>
        {item.content ? (
          <Text
            style={[styles.content, isRTL && styles.rtlText]}
            numberOfLines={expanded ? undefined : 3}
          >
            {item.content}
          </Text>
        ) : null}
        {item.file_url ? (
          <Pressable
            style={({ pressed }) => [styles.fileRow, pressed && styles.cardPressed]}
            onPress={() => {
              void Linking.openURL(item.file_url as string).catch(() => {});
            }}
          >
            <Text style={[styles.fileText, isRTL && styles.rtlText]} numberOfLines={1}>
              {t("news", "attachedFile")}
            </Text>
            <Text style={styles.fileAction}>{t("news", "download")}</Text>
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{t("news", "pageTitle")}</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.chip, category === cat && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[styles.chipText, category === cat && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {categoryLabel(cat)}
                  </Text>
                </Pressable>
              ))}
            </View>
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
              <Text style={[styles.empty, isRTL && styles.rtlText]}>
                {t("news", "noNews")}
              </Text>
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.ink, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: COLORS.chipActiveText },
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
  cardPressed: { opacity: 0.7 },
  cover: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: COLORS.bg,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: COLORS.ink },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  categoryChip: {
    borderRadius: 6,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  categoryChipText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  metaDate: { color: COLORS.subtle, fontSize: 12 },
  content: { color: COLORS.subtle, fontSize: 13, marginTop: 8, lineHeight: 20 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  fileText: { flex: 1, color: COLORS.ink, fontSize: 13, fontWeight: "600" },
  fileAction: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  center: { alignItems: "center", paddingVertical: 32 },
  empty: { color: COLORS.subtle, textAlign: "center" },
  error: { color: COLORS.danger, marginBottom: 12, textAlign: "center" },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: { color: "#FFFFFF", fontWeight: "700" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
});
