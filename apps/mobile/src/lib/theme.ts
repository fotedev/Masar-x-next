/**
 * Theme tokens (spec 020 C3/T103) — the dual-palette source both the
 * ThemeContext and every screen consume.
 *
 * LIGHT-PALETTE INVARIANCE: `lightColors` values are byte-identical to
 * the hex values hardcoded in the screens before spec 020 (locked by
 * theme.test.ts) — dark mode must never change the daytime UI.
 *
 * The dark palette mirrors the web's slate/navy dark surfaces
 * (tailwind darkMode: 'class') with the same ROLE tokens.
 *
 * Pure module: no react-native imports (AsyncStorage persistence only),
 * so the resolution matrix and palette parity are unit-testable.
 *
 * The pre-020 legacy `colors`/`typography` exports are gone — nothing
 * imported them (verified 2026-09-24); screens consumed local COLORS
 * consts, which this spec migrates onto these palettes.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "system" | "light" | "dark";
export type ThemeScheme = "light" | "dark";

export interface Palette {
  /** Brand indigo — buttons, links, active accents. */
  primary: string;
  /** Text on primary surfaces (buttons). */
  onPrimary: string;
  /** Primary text. */
  ink: string;
  /** Secondary text / meta. */
  subtle: string;
  /** Screen background. */
  bg: string;
  /** Card / elevated surface. */
  card: string;
  /** Hairline + card borders. */
  border: string;
  /** Text-input borders (slightly stronger than `border`). */
  inputBorder: string;
  /** Offline/warning banner. */
  banner: string;
  bannerText: string;
  danger: string;
  /** Red-tinted surface (danger chips, wrong answers). */
  dangerBg: string;
  success: string;
  /** Green-tinted surface (correct answers). */
  successBg: string;
  /** Indigo-tinted surface (inactive chips, selected toggles). */
  accentBg: string;
  /** Accent text on `accentBg` (equals primary in light). */
  accentText: string;
  /** Input placeholder text. */
  placeholder: string;
}

export const lightColors: Palette = {
  primary: "#4F46E5",
  onPrimary: "#FFFFFF",
  ink: "#111827",
  subtle: "#6B7280",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  inputBorder: "#CBD5E1",
  banner: "#FEF3C7",
  bannerText: "#92400E",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  success: "#16A34A",
  successBg: "#F0FDF4",
  accentBg: "#EEF2FF",
  accentText: "#4F46E5",
  placeholder: "#94A3B8",
};

export const darkColors: Palette = {
  primary: "#6366F1",
  onPrimary: "#FFFFFF",
  ink: "#F1F5F9",
  subtle: "#94A3B8",
  bg: "#0F172A",
  card: "#1E293B",
  border: "#334155",
  inputBorder: "#475569",
  banner: "#78350F",
  bannerText: "#FCD34D",
  danger: "#F87171",
  dangerBg: "#450A0A",
  success: "#4ADE80",
  successBg: "#052E16",
  accentBg: "#1E1B4B",
  accentText: "#A5B4FC",
  placeholder: "#64748B",
};

/** system → the OS scheme (null treated as light); explicit modes win. */
export function resolveTheme(
  mode: ThemeMode,
  systemScheme: "light" | "dark" | null | undefined,
): ThemeScheme {
  if (mode === "system") return systemScheme === "dark" ? "dark" : "light";
  return mode;
}

export function paletteFor(scheme: ThemeScheme): Palette {
  return scheme === "dark" ? darkColors : lightColors;
}

// --- persistence (mirrors the locale override pattern in src/i18n.ts) -------

const THEME_OVERRIDE_KEY = "masarx_theme_override";

export async function loadThemeOverride(): Promise<ThemeMode | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_OVERRIDE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : null;
  } catch {
    return null;
  }
}

export async function saveThemeOverride(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_OVERRIDE_KEY, mode);
  } catch {
    // Best-effort persistence; the UI stays on the previous mode.
  }
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;
