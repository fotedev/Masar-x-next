/**
 * Subjects tab (spec FR-008 / FR-011): FlatList of subjects from the
 * same Supabase `subjects` table the web app uses (same column names),
 * Arabic name primary with the English name as a secondary line,
 * RTL-aware layout, offline banner and LocalReadCache through
 * useSupabaseQuery (cached content stays readable while offline).
 */
import React, { useCallback, useMemo } from "react";
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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SupabaseClient } from "masarx-shared/supabase";

import type { RootStackParamList } from "../../app/App";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import type { Palette } from "../lib/theme";
import {
  isAcademicFilter,
  levelOrNullFilter,
  resolveEffectiveLevel,
  resolveEffectiveSemester,
  semesterOrNullFilter,
} from "../lib/academic";
import { useAcademicProfile } from "../hooks/useAcademicProfile";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSupabaseQuery } from "../hooks/useSupabaseQuery";

interface SubjectRow {
  id: string;
  name: string;
  name_en: string | null;
  professor: string | null;
  description: string | null;
}

export default function SubjectsScreen() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const { online } = useNetworkStatus();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Spec 019 C4: filter by the profile's academic path (web parity —
  // effectiveLevel/effectiveSemester with defaults 1), gated on the
  // profile load so the first fetch already uses the right filter. The
  // cache key includes level+semester, so saving a new academic path
  // (live-synced via useAcademicProfile) refetches under a new key.
  const academic = useAcademicProfile(user?.id);
  const level = resolveEffectiveLevel(academic.profile?.level);
  const semester = resolveEffectiveSemester(academic.profile?.semester);

  const fetchSubjects = useCallback(
    async (supabase: SupabaseClient): Promise<SubjectRow[]> => {
      // Owner note #1: the three .or() calls are chained INDEPENDENTLY —
      // each is a top-level condition ANDed by PostgREST — matching web
      // useSubjects verbatim (strings locked by academic.test.ts).
      let query = supabase
        .from("subjects")
        .select("id, name, name_en, professor, description")
        .order("name", { ascending: true });
      query = query.or(isAcademicFilter());
      query = query.or(levelOrNullFilter(level));
      query = query.or(semesterOrNullFilter(semester));
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as SubjectRow[];
    },
    [level, semester],
  );

  const { data, loading, error, refetch } = useSupabaseQuery<SubjectRow[]>({
    cacheKey: `subjects:all:${level}:${semester}`,
    fetcher: fetchSubjects,
    enabled: !academic.loading,
  });

  const subjects = data ?? [];

  // Spec 019 C2: the card is now the entry to SubjectDetail (the
  // read-only lecture/content surface ported from the web subject page).
  const renderItem = ({ item }: { item: SubjectRow }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => navigation.navigate("SubjectDetail", { subjectName: item.name })}
    >
      <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>{item.name}</Text>
      {item.name_en ? <Text style={styles.cardSubtitle}>{item.name_en}</Text> : null}
      {item.professor ? <Text style={styles.meta}>{item.professor}</Text> : null}
      {item.description ? (
        <Text style={[styles.description, isRTL && styles.rtlText]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
    </Pressable>
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
            tintColor={colors.primary}
            colors={[colors.primary]}
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
              <ActivityIndicator size="large" color={colors.primary} />
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

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, paddingBottom: 32 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 12,
  },
  banner: {
    backgroundColor: colors.banner,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  bannerText: { color: colors.bannerText, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.7 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  cardSubtitle: { fontSize: 13, color: colors.subtle, marginTop: 2 },
  meta: { fontSize: 13, color: colors.subtle, marginTop: 6 },
  description: { fontSize: 13, color: colors.subtle, marginTop: 6 },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  center: { alignItems: "center", paddingVertical: 32 },
  empty: { color: colors.subtle, textAlign: "center" },
  error: { color: colors.danger, marginBottom: 12, textAlign: "center" },
  footerError: {
    color: colors.subtle,
    textAlign: "center",
    paddingVertical: 10,
    fontSize: 12,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: { color: colors.onPrimary, fontWeight: "700" },
});