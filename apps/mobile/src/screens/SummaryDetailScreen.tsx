/**
 * Summary detail (spec 020 C4/T107-T109): meta + content view ported
 * from the web /summaries/[summaryId] page — the summaries_with_ratings
 * row by id (meta, rating aggregates), PDF/YouTube opened externally
 * via Linking, content rendered through MathText, and the reviews
 * section (web ReviewSection + useReviews port): review_details by
 * summary_id, star 1-5 + optional comment post, delete-own with a
 * native confirm. Guests get the read-only list plus a defensive
 * login prompt (the auth gate means they never reach the tabs).
 */
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDate } from "masarx-shared/format";

import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import type { Palette } from "../lib/theme";
import {
  buildReviewInsert,
  canDeleteReview,
  deleteReview,
  fetchSummaryDetail,
  fetchSummaryReviews,
  insertReview,
  type ReviewDetailRow,
  type SummaryDetailRow,
} from "../lib/reviews";
import { getSupabaseClient } from "../lib/supabase";
import MathText from "../components/MathText";
import type { RootStackParamList } from "../../app/App";

const RATING_MAX = 5;

export default function SummaryDetailScreen() {
  const { t, isRTL, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<{ key: string; name: "SummaryDetail"; params: RootStackParamList["SummaryDetail"] }>();
  const summaryId = route.params.summaryId;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SummaryDetailRow | null>(null);
  const [reviews, setReviews] = useState<ReviewDetailRow[]>([]);

  // Post form state (signed-in only; guests see the read-only list).
  const [rating, setRating] = useState(RATING_MAX);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const [row, reviewRows] = await Promise.all([
        fetchSummaryDetail(supabase, summaryId),
        fetchSummaryReviews(supabase, summaryId),
      ]);
      setDetail(row);
      setReviews(reviewRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [summaryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshAll = useCallback(async () => {
    // Aggregates live in the view — the detail row is refetched alongside
    // the reviews after every post/delete (spec 020 §2.3).
    const supabase = getSupabaseClient();
    const [row, reviewRows] = await Promise.all([
      fetchSummaryDetail(supabase, summaryId),
      fetchSummaryReviews(supabase, summaryId),
    ]);
    setDetail(row);
    setReviews(reviewRows);
  }, [summaryId]);

  const openLink = (url: string) => {
    void Linking.openURL(url).catch(() => {
      // No handler for the scheme on this device — nothing sensible to
      // do in-app; the row stays tappable for a retry.
    });
  };

  const onPromptLogin = () => {
    Alert.alert(
      t("mobile", "summaryDetail.loginRequiredTitle"),
      t("mobile", "summaryDetail.loginRequired"),
    );
  };

  const onSubmitReview = useCallback(async () => {
    if (!user) {
      onPromptLogin();
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const payload = buildReviewInsert({
        rating,
        comment: comment.length > 0 ? comment : null,
        userId: user.id,
        summaryId,
      });
      await insertReview(getSupabaseClient(), payload);
      setComment("");
      setRating(RATING_MAX);
      await refreshAll();
    } catch {
      // Out-of-range ratings cannot come from the picker; surface
      // everything else (network/RLS) as the generic retry message.
      setActionError(t("mobile", "summaryDetail.postFailed"));
    } finally {
      setSubmitting(false);
    }
  }, [user, submitting, rating, comment, summaryId, refreshAll, t]);

  const onDeleteReview = (review: ReviewDetailRow) => {
    Alert.alert(t("reviews", "confirmDelete"), undefined, [
      { text: t("common", "cancel"), style: "cancel" },
      {
        text: t("reviews", "delete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setActionError(null);
            try {
              await deleteReview(getSupabaseClient(), review.id);
              await refreshAll();
            } catch {
              setActionError(t("mobile", "summaryDetail.deleteFailed"));
            }
          })();
        },
      },
    ]);
  };

  const ratingLabel =
    typeof detail?.avg_rating === "number" && detail.avg_rating > 0
      ? `★ ${detail.avg_rating.toFixed(1)} (${detail.reviews_count ?? 0})`
      : null;
  const dateLabel = detail?.created_at
    ? formatDate(detail.created_at, { locale: locale === "ar" ? "ar-EG" : "en-US" })
    : null;
  const metaRows = detail
    ? [
        { label: t("mobile", "summaryDetail.subject"), value: detail.subject },
        { label: t("mobile", "summaryDetail.year"), value: detail.year },
        { label: t("mobile", "summaryDetail.department"), value: detail.department },
        { label: t("mobile", "summaryDetail.contributor"), value: detail.contributor_name },
      ].filter((row): row is { label: string; value: string } => Boolean(row.value))
    : [];

  const renderReview = (review: ReviewDetailRow) => {
    const name = review.reviewer_name || t("reviews", "anonymous");
    const deletable = canDeleteReview(review, user?.id);
    return (
      <View key={review.id} style={styles.reviewCard}>
        <View style={styles.reviewHead}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{name.charAt(0)}</Text>
          </View>
          <View style={styles.reviewHeadText}>
            <Text style={[styles.reviewName, isRTL && styles.rtlText]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.reviewDate, isRTL && styles.rtlText]}>
              {formatDate(review.created_at, { locale: locale === "ar" ? "ar-EG" : "en-US" })}
            </Text>
          </View>
          <Text style={styles.reviewStars}>{"★".repeat(review.rating)}</Text>
        </View>
        {review.comment ? (
          <Text style={[styles.reviewComment, isRTL && styles.rtlText]}>{review.comment}</Text>
        ) : null}
        {deletable ? (
          <Pressable
            style={styles.deleteButton}
            onPress={() => onDeleteReview(review)}
            hitSlop={8}
          >
            <Text style={styles.deleteButtonText}>{t("reviews", "delete")}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>{locale === "ar" ? ">" : "<"}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {detail?.title ?? t("mobile", "tabs.summaries")}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryButtonText}>{t("mobile", "common.retry")}</Text>
          </Pressable>
        </View>
      ) : !detail ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{t("mobile", "summaryDetail.notFound")}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>{detail.title}</Text>
            {ratingLabel ? <Text style={styles.ratingLine}>{ratingLabel}</Text> : null}
            {metaRows.map((row) => (
              <View key={row.label} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{row.label}</Text>
                <Text style={[styles.metaValue, isRTL && styles.rtlText]} numberOfLines={1}>
                  {row.value}
                </Text>
              </View>
            ))}
            {dateLabel ? (
              <Text style={[styles.dateLine, isRTL && styles.rtlText]}>{dateLabel}</Text>
            ) : null}
          </View>

          {detail.pdf_url || detail.youtube_url ? (
            <View style={styles.card}>
              {detail.pdf_url ? (
                <Pressable
                  style={({ pressed }) => [styles.linkRow, pressed && styles.rowPressed]}
                  onPress={() => openLink(detail.pdf_url as string)}
                >
                  <Text style={styles.linkRowText}>{t("mobile", "summaryDetail.pdf")}</Text>
                  <Text style={styles.linkRowAction}>{locale === "ar" ? "<" : ">"}</Text>
                </Pressable>
              ) : null}
              {detail.youtube_url ? (
                <Pressable
                  style={({ pressed }) => [styles.linkRow, pressed && styles.rowPressed]}
                  onPress={() => openLink(detail.youtube_url as string)}
                >
                  <Text style={styles.linkRowText}>{t("mobile", "summaryDetail.youtube")}</Text>
                  <Text style={styles.linkRowAction}>{locale === "ar" ? "<" : ">"}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {detail.content ? (
            <View style={styles.card}>
              <MathText text={detail.content} rtl={locale === "ar"} />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t("reviews", "heading", { count: reviews.length })}
            </Text>

            {!user ? (
              <Pressable style={styles.guestChip} onPress={onPromptLogin}>
                <Text style={styles.guestChipText}>{t("mobile", "quiz.guestMode")}</Text>
              </Pressable>
            ) : (
              <View style={styles.formCard}>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() => setRating(star)}
                      hitSlop={6}
                      style={styles.starButton}
                    >
                      <Text style={[styles.starGlyph, star <= rating ? styles.starOn : styles.starOff]}>
                        {star <= rating ? "★" : "☆"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[styles.commentInput, isRTL && styles.rtlTextInput]}
                  value={comment}
                  onChangeText={setComment}
                  placeholder={t("mobile", "summaryDetail.commentPlaceholder")}
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={3}
                />
                {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && styles.rowPressed,
                    submitting && styles.submitButtonDisabled,
                  ]}
                  onPress={() => void onSubmitReview()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.submitButtonText}>{t("reviews", "addReview")}</Text>
                  )}
                </Pressable>
              </View>
            )}

            {reviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
                  {t("reviews", "emptyTitle")}
                </Text>
                <Text style={[styles.emptyHint, isRTL && styles.rtlText]}>
                  {t("reviews", "emptyHint")}
                </Text>
              </View>
            ) : (
              reviews.map(renderReview)
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    backText: { color: colors.primary, fontSize: 22, fontWeight: "700", paddingHorizontal: 4 },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.ink },
    content: { padding: 16, paddingBottom: 40 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.ink },
    ratingLine: { fontSize: 14, color: colors.subtle, marginTop: 6, fontWeight: "600" },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
    },
    metaLabel: { color: colors.subtle, fontSize: 13, fontWeight: "600" },
    metaValue: { color: colors.ink, fontSize: 13, flexShrink: 1, marginLeft: 12, textAlign: "right" },
    dateLine: { color: colors.subtle, fontSize: 12, marginTop: 10 },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
    },
    rowPressed: { opacity: 0.7 },
    linkRowText: { color: colors.primary, fontSize: 14, fontWeight: "600", flexShrink: 1 },
    linkRowAction: { color: colors.primary, fontSize: 14, marginLeft: 12 },
    section: { marginTop: 4 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginBottom: 10 },
    guestChip: {
      alignSelf: "flex-start",
      backgroundColor: colors.banner,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 10,
    },
    guestChipText: { color: colors.bannerText, fontSize: 11, fontWeight: "700" },
    formCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 12,
    },
    starRow: { flexDirection: "row", marginBottom: 10 },
    starButton: { paddingHorizontal: 4, paddingVertical: 2 },
    starGlyph: { fontSize: 26 },
    starOn: { color: "#F59E0B" },
    starOff: { color: colors.border },
    commentInput: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.ink,
      fontSize: 14,
      minHeight: 70,
      textAlignVertical: "top",
      marginBottom: 10,
    },
    rtlTextInput: { textAlign: "right" },
    actionError: { color: colors.danger, fontSize: 12, marginBottom: 8 },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
      minHeight: 42,
    },
    submitButtonDisabled: { opacity: 0.6 },
    submitButtonText: { color: colors.onPrimary, fontWeight: "700", fontSize: 14 },
    emptyReviews: { alignItems: "center", paddingVertical: 18 },
    emptyTitle: { color: colors.ink, fontWeight: "700", marginBottom: 4 },
    emptyHint: { color: colors.subtle, fontSize: 13 },
    reviewCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
    },
    reviewHead: { flexDirection: "row", alignItems: "center" },
    avatarCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accentBg,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: colors.accentText, fontSize: 14, fontWeight: "700" },
    reviewHeadText: { flex: 1, marginHorizontal: 10 },
    reviewName: { color: colors.ink, fontSize: 13, fontWeight: "700" },
    reviewDate: { color: colors.subtle, fontSize: 11, marginTop: 2 },
    reviewStars: { color: "#F59E0B", fontSize: 13 },
    reviewComment: { color: colors.ink, fontSize: 13, lineHeight: 20, marginTop: 8 },
    deleteButton: { alignSelf: "flex-end", marginTop: 8, paddingHorizontal: 6, paddingVertical: 2 },
    deleteButtonText: { color: colors.danger, fontSize: 12, fontWeight: "600" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    empty: { color: colors.subtle, textAlign: "center" },
    error: { color: colors.danger, marginBottom: 12, textAlign: "center" },
    retryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    retryButtonText: { color: colors.onPrimary, fontWeight: "700" },
    rtlText: { textAlign: "right" },
  });
