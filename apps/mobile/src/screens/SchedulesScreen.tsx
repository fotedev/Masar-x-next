/**
 * Schedules tab (spec 047): weekly cohort timetables served from the
 * shared static dataset (masarx-shared/schedules — the same validated
 * JSONs the web /schedules page uses). Fully offline: no network calls.
 *
 * Structure: batch chips → department-block chips → day chips (today
 * auto-selected, marked with a dot) → a vertical time-slot list where each
 * non-empty source cell is a color-coded card. Cell text keeps its exact
 * source content (spec 034 fidelity doctrine) — `cellParts` only splits
 * presentation lines, and the per-subject color comes from the same stable
 * hash the web uses, so both surfaces agree.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import type { Palette } from "../lib/theme";
import type { ThemeScheme } from "../lib/theme";
import {
  cellParts,
  detectBlocks,
  headerRowIndex,
  scheduleSheets,
  splitDays,
  subjectColorIndex,
  timeSlotHour,
  todayDayName,
  weekdayKeyOf,
  type WeekdayKey,
} from "masarx-shared/schedules";

/** Locale-neutral weekday key → shared message key (schedules namespace). */
const DAY_MSG_KEYS: Record<WeekdayKey, string> = {
  saturday: "daySaturday",
  sunday: "daySunday",
  monday: "dayMonday",
  tuesday: "dayTuesday",
  wednesday: "dayWednesday",
  thursday: "dayThursday",
  friday: "dayFriday",
};

/** Subject chip palette — mirrors the web SectionTimetable hues. */
interface ChipColors {
  bg: string;
  border: string;
  text: string;
}

const CHIP_LIGHT: ChipColors[] = [
  { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" },
  { bg: "#F5F3FF", border: "#DDD6FE", text: "#6D28D9" },
  { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
  { bg: "#FFF1F2", border: "#FECDD3", text: "#BE123C" },
  { bg: "#F0F9FF", border: "#BAE6FD", text: "#0369A1" },
  { bg: "#FDF4FF", border: "#F5D0FE", text: "#A21CAF" },
  { bg: "#F7FEE7", border: "#D9F99D", text: "#4D7C0F" },
];

const CHIP_DARK: ChipColors[] = [
  { bg: "#172554", border: "#1E3A8A", text: "#93C5FD" },
  { bg: "#064E3B", border: "#065F46", text: "#6EE7B7" },
  { bg: "#2E1065", border: "#4C1D95", text: "#C4B5FD" },
  { bg: "#451A03", border: "#92400E", text: "#FCD34D" },
  { bg: "#4C0519", border: "#9F1239", text: "#FDA4AF" },
  { bg: "#082F49", border: "#075985", text: "#7DD3FC" },
  { bg: "#4A044E", border: "#86198F", text: "#F0ABFC" },
  { bg: "#1A2E05", border: "#3F6212", text: "#BEF264" },
];

export default function SchedulesScreen() {
  const { t, locale } = useI18n();
  const { colors, resolved } = useTheme();
  const styles = useMemo(() => createStyles(colors, resolved), [colors, resolved]);

  const [sheetIdx, setSheetIdx] = useState(0);
  const sheet = scheduleSheets[Math.min(sheetIdx, scheduleSheets.length - 1)];
  const blocks = useMemo(() => detectBlocks(sheet), [sheet]);
  const [blockIdx, setBlockIdx] = useState(0);
  const block = blocks[Math.min(blockIdx, Math.max(blocks.length - 1, 0))];
  const days = useMemo(
    () => (block ? splitDays(sheet, block) : []),
    [sheet, block],
  );

  // Today + current hour (device clock — never rendered during module eval).
  const [todayKey, setTodayKey] = useState<WeekdayKey | null>(null);
  const [nowHour, setNowHour] = useState<number | null>(null);
  useEffect(() => {
    setTodayKey(weekdayKeyOf(todayDayName()));
    setNowHour(new Date().getHours());
  }, []);

  const [dayIdx, setDayIdx] = useState(0);
  // A new sheet restarts at block 0; today's selection re-applies per block.
  useEffect(() => {
    setBlockIdx(0);
    setDayIdx(0);
  }, [sheetIdx]);
  useEffect(() => {
    if (!todayKey) return;
    const idx = days.findIndex((d) => weekdayKeyOf(d.day) === todayKey);
    if (idx >= 0) setDayIdx(idx);
  }, [days, todayKey]);

  if (!block || days.length === 0) return null;

  const day = days[Math.min(dayIdx, days.length - 1)];
  const dayKey = weekdayKeyOf(day.day);
  const isToday = todayKey !== null && dayKey === todayKey;
  const sectionRow = sheet.rows[headerRowIndex(sheet) + 1] ?? [];

  const slots = day.rowIndexes.map((r) => {
    const timeCell = sheet.rows[r][block.timeCol] ?? "";
    return {
      time: timeCell.trim(),
      hour: timeSlotHour(timeCell),
      entries: block.sectionCols
        .map((col) => (sheet.rows[r][col] ?? "").trim())
        .filter((text) => text !== ""),
    };
  });
  const hasClasses = slots.some((s) => s.entries.length > 0);

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
  });

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("schedules", "title")}</Text>
        <Text style={styles.subtitle}>{t("schedules", "description")}</Text>

        {/* Batch chips (the 4 cohort sheets) */}
        <View style={styles.chipRow}>
          {scheduleSheets.map((s, i) => (
            <Pressable
              key={s.id}
              style={[styles.chip, i === sheetIdx && styles.chipActive]}
              onPress={() => setSheetIdx(i)}
            >
              <Text style={[styles.chipText, i === sheetIdx && styles.chipTextActive]}>
                {t("schedules", s.id)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Department-block chips */}
        <View style={styles.chipRow}>
          {blocks.map((b, i) => (
            <Pressable
              key={b.timeCol}
              style={[styles.chip, i === blockIdx && styles.chipActive]}
              onPress={() => setBlockIdx(i)}
            >
              <Text style={[styles.chipText, i === blockIdx && styles.chipTextActive]} numberOfLines={1}>
                {b.label ?? t("schedules", "blockN", { n: i + 1 })}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Day chips — today carries a dot marker */}
        <View style={styles.chipRow}>
          {days.map((d, i) => {
            const key = weekdayKeyOf(d.day);
            const label = key ? t("schedules", DAY_MSG_KEYS[key]) : d.day;
            const active = i === Math.min(dayIdx, days.length - 1);
            return (
              <Pressable
                key={`${d.day}-${i}`}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setDayIdx(i)}
              >
                <View style={styles.dayChipInner}>
                  {todayKey !== null && key === todayKey && <View style={styles.todayDot} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.meta}>
          {t("schedules", "fetchedAt", {
            date: dateFmt.format(new Date(sheet.fetchedAt)),
          })}
          {" · "}
          {t("schedules", "sourceNote")}
        </Text>

        {hasClasses ? (
          slots.map((slot, i) => {
            const isCurrentSlot =
              isToday && nowHour !== null && slot.hour !== null && nowHour === slot.hour;
            return (
              <View key={i} style={[styles.slotRow, isCurrentSlot && styles.slotRowCurrent]}>
                <Text style={[styles.time, isCurrentSlot && styles.timeCurrent]}>
                  {slot.time}
                </Text>
                <View style={styles.entries}>
                  {slot.entries.map((text, j) => {
                    const parts = cellParts(text);
                    const chip = (resolved === "dark" ? CHIP_DARK : CHIP_LIGHT)[
                      subjectColorIndex(parts.primary)
                    ];
                    return (
                      <View
                        key={j}
                        style={[styles.entryCard, { backgroundColor: chip.bg, borderColor: chip.border }]}
                      >
                        <Text style={[styles.entryPrimary, { color: chip.text }]}>
                          {parts.primary}
                        </Text>
                        {parts.secondary.map((line, k) => (
                          <Text key={k} style={[styles.entrySecondary, { color: chip.text }]}>
                            {line}
                          </Text>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.freeDay}>{t("schedules", "freeDay")}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: Palette, scheme: ThemeScheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 32, gap: 12 },
    title: { fontSize: 26, fontWeight: "800", color: colors.ink },
    subtitle: { fontSize: 14, color: colors.subtle, lineHeight: 20 },
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
    dayChipInner: { flexDirection: "row", alignItems: "center", gap: 6 },
    todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    meta: { fontSize: 12, color: colors.subtle, lineHeight: 17 },
    slotRow: {
      flexDirection: "row",
      gap: 10,
      borderRadius: 12,
      padding: 4,
    },
    slotRowCurrent: {
      backgroundColor: colors.accentBg,
    },
    time: {
      width: 64,
      fontSize: 12,
      fontWeight: "700",
      color: colors.subtle,
      writingDirection: "ltr",
      paddingTop: 10,
    },
    timeCurrent: { color: colors.accentText },
    entries: { flex: 1, gap: 6 },
    entryCard: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    entryPrimary: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
    entrySecondary: { fontSize: 12, lineHeight: 17, opacity: 0.75, marginTop: 2 },
    freeDay: {
      fontSize: 14,
      color: colors.subtle,
      textAlign: "center",
      paddingVertical: 24,
    },
  });
