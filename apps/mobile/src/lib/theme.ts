/**
 * Tiny theme constants for the mobile app. The web app is the design
 * source of truth (slate + brand blue); these tokens mirror its light
 * palette closely enough for the v1 mobile surfaces.
 */
export const colors = {
  brand: "#1d4ed8",
  brandDark: "#1e40af",
  background: "#f8fafc",
  card: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  accent: "#0ea5e9",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  chipBackground: "#eef2ff",
  offlineBackground: "#fef3c7",
  offlineText: "#92400e",
} as const;

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

export const typography = {
  title: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  subtitle: { fontSize: 16, fontWeight: "600" as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted },
} as const;