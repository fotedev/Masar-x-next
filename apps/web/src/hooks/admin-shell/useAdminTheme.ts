"use client";

import { useTheme } from "@/contexts/ThemeContext";

/**
 * Thin adapter over the app's existing ThemeContext.
 *
 * The Masar X app already owns theme state (localStorage "theme", .dark
 * class on <html>, system fallback) via ThemeProvider — the admin shell
 * MUST NOT run a second theme system. This adapter exposes exactly the
 * surface the shell needs and nothing more.
 */
export interface UseAdminThemeResult {
  theme: "light" | "dark";
  mounted: boolean;
  toggleTheme: () => void;
}

export function useAdminTheme(): UseAdminThemeResult {
  const { theme, toggleTheme } = useTheme();
  // ThemeContext's `theme` state is client-resolved in an effect; the shell
  // gates theme-dependent labels on the provider's own mounted flag via CSS
  // (dark: variants), so no extra mounted tracking is needed here.
  return { theme, mounted: true, toggleTheme };
}
