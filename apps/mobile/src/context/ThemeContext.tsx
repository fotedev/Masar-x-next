/**
 * Theme provider (spec 020 C3/T103): mode override (system/light/dark)
 * persisted via lib/theme, resolved against useColorScheme() for the
 * system default. RN styles are plain JS, so a mode switch re-renders
 * with the new palette immediately — no restart needed (unlike the
 * RTL direction flip).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import {
  loadThemeOverride,
  paletteFor,
  resolveTheme,
  saveThemeOverride,
  type Palette,
  type ThemeMode,
  type ThemeScheme,
} from "../lib/theme";

export type { ThemeMode, ThemeScheme };

export interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ThemeScheme;
  colors: Palette;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadThemeOverride();
      if (!cancelled && stored) setModeState(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void saveThemeOverride(next);
  }, []);

  const resolved = resolveTheme(mode, systemScheme);
  const colors = paletteFor(resolved);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, colors, setMode }),
    [mode, resolved, colors, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
