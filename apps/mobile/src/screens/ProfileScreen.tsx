/**
 * Profile tab: account info, sign out (Supabase auth through
 * AuthContext), language override (I18nContext - a direction flip
 * prompts for an app restart, the standard RN/RTL constraint), and
 * the academic path card (spec 019 C4 — level/department/semester on
 * the profiles row, the same fields web's profile page edits).
 */
import Constants from "expo-constants";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useTheme, type ThemeMode } from "../context/ThemeContext";
import type { Palette } from "../lib/theme";
import { useAcademicProfile } from "../hooks/useAcademicProfile";
import {
  departmentsForLevel,
  fetchAcademicOptions,
  saveAcademicProfile,
  type AcademicOptions,
} from "../lib/academic";
import { getSupabaseClient } from "../lib/supabase";

const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { t, locale, changeLocale } = useI18n();
  const { colors, mode: themeMode, resolved: themeResolved, setMode: setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Spec 019 C4: academic path (level -> department -> semester).
  const academic = useAcademicProfile(user?.id);
  const [options, setOptions] = useState<AcademicOptions | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [selLevel, setSelLevel] = useState<number | null>(null);
  const [selDept, setSelDept] = useState<string | null>(null);
  const [selSemester, setSelSemester] = useState<number | null>(null);
  const [savingAcademic, setSavingAcademic] = useState(false);
  const [academicNote, setAcademicNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // Adopt the saved profile as the selection whenever it (re)loads;
    // local edits after that stay untouched until the next save/reload.
    if (academic.profile) {
      setSelLevel(academic.profile.level);
      setSelDept(academic.profile.department_id);
      setSelSemester(academic.profile.semester);
    }
  }, [academic.profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAcademicOptions(getSupabaseClient());
        if (!cancelled) {
          setOptions(data);
          setOptionsError(false);
        }
      } catch {
        if (!cancelled) setOptionsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSaveAcademic = async () => {
    if (savingAcademic || !user || selLevel == null || selSemester == null) return;
    setSavingAcademic(true);
    setAcademicNote(null);
    try {
      await saveAcademicProfile(getSupabaseClient(), user.id, {
        level: selLevel,
        semester: selSemester,
        department_id: selDept,
      });
      setAcademicNote({ ok: true, text: t("mobile", "profile.academicSaved") });
      academic.reload(); // live-syncs the Subjects tab filter
    } catch {
      setAcademicNote({ ok: false, text: t("mobile", "profile.academicSaveFailed") });
    } finally {
      setSavingAcademic(false);
    }
  };

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    typeof meta.name === "string" && meta.name
      ? meta.name
      : typeof meta.full_name === "string" && meta.full_name
        ? meta.full_name
        : null;
  // The name line must not fall back to the email — that duplicated the
  // email rendered right below it for accounts without name metadata.
  const email = user?.email ?? null;
  const initials = (displayName ?? email ?? "?").charAt(0).toUpperCase();

  const onSignOut = () => {
    Alert.alert(
      t("mobile", "profile.signOutConfirmTitle"),
      t("mobile", "profile.signOutConfirmMessage"),
      [
        { text: t("mobile", "common.cancel"), style: "cancel" },
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
              {displayName ?? t("mobile", "profile.anonymousUser")}
            </Text>
            {email ? (
              <Text style={styles.accountEmail} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
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
          <Text style={styles.hint}>{t("mobile", "profile.languageHint")}</Text>
        </View>

        {/* Spec 020 C3: theme mode — system/light/dark, applied live. */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("mobile", "profile.theme")}</Text>
          <View style={styles.languageRow}>
            {THEME_MODES.map((modeOption) => (
              <Pressable
                key={modeOption}
                style={[styles.languageButton, themeMode === modeOption && styles.languageButtonActive]}
                onPress={() => setThemeMode(modeOption)}
              >
                <Text
                  style={[
                    styles.languageButtonText,
                    themeMode === modeOption && styles.languageButtonTextActive,
                  ]}
                >
                  {t("mobile", `profile.theme.${modeOption}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("mobile", "profile.academic")}</Text>
          {optionsError ? (
            <Text style={styles.noteError}>
              {t("mobile", "profile.academicLoadFailed")}
            </Text>
          ) : !options ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={styles.pickerLabel}>{t("mobile", "profile.level")}</Text>
              <View style={styles.chipRow}>
                {options.levels.map((lvl) => (
                  <Pressable
                    key={lvl.id}
                    style={[styles.chip, selLevel === lvl.level_number && styles.chipActive]}
                    onPress={() => {
                      // Web parity: changing the level resets the department.
                      setSelLevel(lvl.level_number);
                      setSelDept(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selLevel === lvl.level_number && styles.chipTextActive,
                      ]}
                    >
                      {lvl.level_number}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.pickerLabel}>{t("mobile", "profile.department")}</Text>
              <View style={styles.chipRow}>
                {selLevel == null ? (
                  <Text style={styles.hint}>{t("mobile", "profile.pickLevelFirst")}</Text>
                ) : (
                  <>
                    <Pressable
                      style={[styles.chip, selDept === null && styles.chipActive]}
                      onPress={() => setSelDept(null)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selDept === null && styles.chipTextActive,
                        ]}
                      >
                        {t("mobile", "profile.noDepartment")}
                      </Text>
                    </Pressable>
                    {departmentsForLevel(
                      options,
                      options.levels.find((l) => l.level_number === selLevel)?.id ?? null,
                    ).map((dept) => (
                      <Pressable
                        key={dept.id}
                        style={[styles.chip, selDept === dept.id && styles.chipActive]}
                        onPress={() => setSelDept(dept.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selDept === dept.id && styles.chipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {dept.name}
                        </Text>
                      </Pressable>
                    ))}
                  </>
                )}
              </View>

              <Text style={styles.pickerLabel}>{t("mobile", "profile.semester")}</Text>
              <View style={styles.chipRow}>
                {[1, 2, 3].map((sem) => (
                  <Pressable
                    key={sem}
                    style={[styles.chip, selSemester === sem && styles.chipActive]}
                    onPress={() => setSelSemester(sem)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selSemester === sem && styles.chipTextActive,
                      ]}
                    >
                      {sem}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.button, savingAcademic && styles.buttonDisabled]}
                onPress={() => void onSaveAcademic()}
                disabled={savingAcademic || selLevel == null || selSemester == null}
              >
                {savingAcademic ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.buttonText}>
                    {t("mobile", "profile.saveAcademic")}
                  </Text>
                )}
              </Pressable>
              {academicNote ? (
                <Text style={academicNote.ok ? styles.noteOk : styles.noteError}>
                  {academicNote.text}
                </Text>
              ) : null}
            </>
          )}
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

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink, marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onPrimary, fontSize: 20, fontWeight: "800" },
  accountText: { marginTop: 10 },
  accountName: { fontSize: 16, fontWeight: "700", color: colors.ink },
  accountEmail: { fontSize: 13, color: colors.subtle, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  languageRow: { flexDirection: "row" },
  languageButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: "center",
    marginRight: 8,
  },
  languageButtonActive: { borderColor: colors.primary, backgroundColor: colors.accentBg },
  languageButtonText: { color: colors.ink, fontWeight: "600" },
  languageButtonTextActive: { color: colors.accentText, fontWeight: "800" },
  hint: { color: colors.subtle, fontSize: 12, marginTop: 8 },
  pickerLabel: {
    color: colors.ink,
    fontWeight: "600",
    fontSize: 13,
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.accentBg },
  chipText: { color: colors.ink, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.accentText, fontWeight: "800" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.onPrimary, fontWeight: "700" },
  stageText: { color: colors.primary, marginTop: 8, fontSize: 13, fontWeight: "600" },
  noteOk: { color: colors.success, marginTop: 8, fontSize: 13 },
  noteError: { color: colors.danger, marginTop: 8, fontSize: 13 },
  signOutButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  signOutText: { color: colors.danger, fontWeight: "700" },
  version: { color: colors.subtle, textAlign: "center", fontSize: 12 },
});