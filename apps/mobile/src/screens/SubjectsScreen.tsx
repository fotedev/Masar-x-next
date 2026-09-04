/**
 * Subjects tab (spec FR-008 / FR-011): FlatList of subjects from the
 * same Supabase `subjects` table the web app uses (same column names),
 * Arabic name primary with the English name as a secondary line,
 * RTL-aware layout, offline banner and LocalReadCache through
 * useSupabaseQuery (cached content stays readable while offline).
 */
import React from "react";
import {
  ActivityIndicator,
  FlatList,
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

interface SubjectRow {
  id: string;
  name: string;
  name_en: string | null;
  professor: string | null;
  description: string | null;
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

async function fetchSubjects(supabase: SupabaseClient): Promise<SubjectRow[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, name_en, professor, description")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as SubjectRow[];
}

export default function SubjectsScreen() {
  const { t, isRTL } = useI18n();
  const { online } = useNetworkStatus();
  const { data, loading, error, refetch } = useSupabaseQuery<SubjectRow[]>({
    cacheKey: "subjects:all",
    fetcher: fetchSubjects,
  });

  const subjects = data ?? [];

  const renderItem = ({ item }: { item: SubjectRow }) => (
    <View style={styles.card}>
      <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>{item.name}</Text>
      {item.name_en ? <Text style={styles.cardSubtitle}>{item.name_en}</Text> : null}
      {item.professor ? <Text style={styles.meta}>{item.professor}</Text> : null}
      {item.description ? (
        <Text style={[styles.description, isRTL && styles.rtlText]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={subjects}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{t("subjects", "title")}</Text>
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
          error && subjects.length > 0 ? (
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
              <Text style={styles.empty}>{t("subjects", "emptyAcademicTitle")}</Text>
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
  cardTitle: { fontSize: 17, fontWeight: "700", color: COLORS.ink },
  cardSubtitle: { fontSize: 13, color: COLORS.subtle, marginTop: 2 },
  meta: { fontSize: 13, color: COLORS.subtle, marginTop: 6 },
  description: { fontSize: 13, color: COLORS.subtle, marginTop: 6 },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
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