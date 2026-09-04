/**
 * Profile tab: account info, sign out (Supabase auth through
 * AuthContext), language override (I18nContext - a direction flip
 * prompts for an app restart, the standard RN/RTL constraint), and
 * the PDF upload entry point (src/lib/upload.ts -> summaries-pdfs
 * bucket, the same backend path the web app uses).
 */
import Constants from "expo-constants";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { getSupabaseClient } from "../lib/supabase";
import { pickPdf, uploadSummaryPdf, UploadError, type UploadProgress } from "../lib/upload";

const UPLOAD_STAGE_KEYS: Partial<Record<UploadProgress["stage"], string>> = {
  reading: "upload.reading",
  uploading: "upload.uploading",
  finalizing: "upload.finalizing",
  done: "upload.done",
};

const COLORS = {
  primary: "#4F46E5",
  ink: "#111827",
  subtle: "#6B7280",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  danger: "#DC2626",
  success: "#16A34A",
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { t, locale, changeLocale } = useI18n();

  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<{ ok: boolean; text: string } | null>(null);

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    typeof meta.name === "string" && meta.name
      ? meta.name
      : typeof meta.full_name === "string" && meta.full_name
        ? meta.full_name
        : null;
  const email = user?.email ?? t("mobile", "profile.anonymousUser");
  const initials = (displayName ?? email).charAt(0).toUpperCase();

  const onSignOut = () => {
    Alert.alert(
      t("mobile", "profile.signOutConfirmTitle"),
      t("mobile", "profile.signOutConfirmMessage"),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: t("mobile", "profile.signOut"),
          style: "destructive",
          onPress: () => {
            void signOut().catch(() => {});
          },
        },
      ],
    );
  };

  const onPickAndUpload = async () => {
    if (uploading) return;
    setUploading(true);
    setUploadNote(null);
    setStage(t("mobile", "upload.picking"));
    try {
      const pdf = await pickPdf();
      await uploadSummaryPdf(getSupabaseClient(), pdf, (progress) => {
        const key = UPLOAD_STAGE_KEYS[progress.stage];
        if (key) setStage(t("mobile", key));
      });
      setStage(null);
      setUploadNote({ ok: true, text: t("mobile", "upload.done") });
    } catch (err) {
      setStage(null);
      if (err instanceof UploadError) {
        if (err.code === "cancelled") return; // user backed out of the picker
        const map: Record<typeof err.code, string> = {
          "not-pdf": "upload.notPdf",
          "too-large": "upload.tooLarge",
          unauthenticated: "upload.needAuth",
          "upload-failed": "upload.failed",
        };
        setUploadNote({ ok: false, text: t("mobile", map[err.code]) });
      } else {
        setUploadNote({ ok: false, text: t("mobile", "upload.failed") });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.title}>{t("mobile", "tabs.profile")}</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.accountText}>
            <Text style={styles.accountName} numberOfLines={1}>
              {displayName ?? email}
            </Text>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("mobile", "profile.language")}</Text>
          <View style={styles.languageRow}>
            <Pressable
              style={[styles.languageButton, locale === "ar" && styles.languageButtonActive]}
              onPress={() => void changeLocale("ar")}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  locale === "ar" && styles.languageButtonTextActive,
                ]}
              >
                {t("mobile", "profile.languageArabic")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.languageButton, locale === "en" && styles.languageButtonActive]}
              onPress={() => void changeLocale("en")}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  locale === "en" && styles.languageButtonTextActive,
                ]}
              >
                {t("mobile", "profile.languageEnglish")}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            {locale === "ar"
              ? "May require restarting the app to apply the direction."
              : "Direction changes may require restarting the app."}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("mobile", "upload.pickPdf")}</Text>
          <Text style={styles.hint}>
            {locale === "ar"
              ? "Upload a PDF to the Masar X storage (same as the web app)."
              : "Upload a PDF to the Masar X storage (same as the web app)."}
          </Text>
          <Pressable
            style={[styles.button, uploading && styles.buttonDisabled]}
            onPress={() => void onPickAndUpload()}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t("mobile", "upload.pickPdf")}</Text>
            )}
          </Pressable>
          {stage ? <Text style={styles.stageText}>{stage}</Text> : null}
          {uploadNote ? (
            <Text style={uploadNote.ok ? styles.noteOk : styles.noteError}>{uploadNote.text}</Text>
          ) : null}
        </View>

        <Pressable style={styles.signOutButton} onPress={onSignOut}>
          <Text style={styles.signOutText}>{t("mobile", "profile.signOut")}</Text>
        </Pressable>

        <Text style={styles.version}>
          {t("mobile", "profile.appVersion")}: {Constants.expoConfig?.version ?? "-"}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  list: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.ink, marginBottom: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  accountText: { marginTop: 10 },
  accountName: { fontSize: 16, fontWeight: "700", color: COLORS.ink },
  accountEmail: { fontSize: 13, color: COLORS.subtle, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.ink, marginBottom: 8 },
  languageRow: { flexDirection: "row" },
  languageButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: "center",
    marginRight: 8,
  },
  languageButtonActive: { borderColor: COLORS.primary, backgroundColor: "#EEF2FF" },
  languageButtonText: { color: COLORS.ink, fontWeight: "600" },
  languageButtonTextActive: { color: COLORS.primary, fontWeight: "800" },
  hint: { color: COLORS.subtle, fontSize: 12, marginTop: 8 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  stageText: { color: COLORS.primary, marginTop: 8, fontSize: 13, fontWeight: "600" },
  noteOk: { color: COLORS.success, marginTop: 8, fontSize: 13 },
  noteError: { color: COLORS.danger, marginTop: 8, fontSize: 13 },
  signOutButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  signOutText: { color: COLORS.danger, fontWeight: "700" },
  version: { color: COLORS.subtle, textAlign: "center", fontSize: 12 },
});