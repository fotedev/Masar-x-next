/**
 * Quizzes tab: approved quizzes from the same `quizzes` table the web
 * app plays from (status filter mirrors the public web listing).
 * Tapping a quiz pushes QuizPlay on the root stack.
 */
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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

import type { RootStackParamList } from "../../app/App";
import { useI18n } from "../context/I18nContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSupabaseQuery } from "../hooks/useSupabaseQuery";

interface QuizRow {
  id: string;
  title: string;
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

async function fetchQuizzes(supabase: SupabaseClient): Promise<QuizRow[]> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, description, status")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<QuizRow & { status?: string | null }>).map(
    (row) => ({ id: row.id, title: row.title, description: row.description }),
  );
}

export default function QuizzesScreen() {
  const { t } = useI18n();
  const { online } = useNetworkStatus();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data, loading, error, refetch } = useSupabaseQuery<QuizRow[]>({
    cacheKey: "quizzes:approved",
    fetcher: fetchQuizzes,
  });

  const quizzes = data ?? [];

  const renderItem = ({ item }: { item: QuizRow }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => navigation.navigate("QuizPlay", { quizId: item.id, title: item.title })}
    >
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description || t("quizzes", "noDescription")}
        </Text>
      </View>
      <View style={styles.startChip}>
        <Text style={styles.startChipText}>{t("quizzes", "startExam")}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <FlatList
        data={quizzes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{t("mobile", "tabs.quizzes")}</Text>
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
              <Text style={styles.empty}>{t("quizzes", "noExams")}</Text>
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
    flexDirection: "row",
    alignItems: "center",
  },
  cardPressed: { opacity: 0.85 },
  cardBody: { flex: 1, paddingRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: COLORS.ink },
  cardDescription: { fontSize: 13, color: COLORS.subtle, marginTop: 4 },
  startChip: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  startChipText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
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
});