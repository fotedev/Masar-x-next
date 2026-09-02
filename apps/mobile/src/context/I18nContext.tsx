/**
 * I18n provider: resolves the effective locale (in-app override >
 * device language), exposes t() bound to it, and drives RTL layout
 * (spec FR-008).
 *
 * Runtime RTL switch: React Native can only flip layout direction at
 * startup, so when the user changes the language in a direction-changing
 * way we call I18nManager.forceRTL + prompt for a restart (standard RN
 * behavior, mirrors how Expo apps handle it).
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
import { Alert, I18nManager } from "react-native";

import {
  dir,
  isRTL,
  resolveLocale,
  setLocaleOverride,
  translateMessage,
  type Dir,
  type Locale,
  type MessageValues,
} from "../i18n";

export interface I18nContextValue {
  locale: Locale;
  isRTL: boolean;
  dir: Dir;
  t: (namespace: string, key: string, values?: MessageValues) => string;
  /** Persist the in-app override; null clears it (follow device again). */
  changeLocale: (locale: Locale | null) => Promise<void>;
  /** True while the first resolveLocale() round-trip is pending. */
  resolving: boolean;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("ar");
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let mounted = true;
    resolveLocale().then((resolved) => {
      if (!mounted) return;
      setLocale(resolved);
      setResolving(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // FR-008: layout direction follows the effective locale.
  useEffect(() => {
    const rtl = isRTL(locale);
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(rtl);
  }, [locale]);

  const t = useCallback(
    (namespace: string, key: string, values?: MessageValues) =>
      translateMessage(locale, namespace, key, values),
    [locale],
  );

  const changeLocale = useCallback(
    async (next: Locale | null) => {
      const previous = locale;
      await setLocaleOverride(next);
      const resolved = next ?? (await resolveLocale());
      setLocale(resolved);
      if (isRTL(previous) !== isRTL(resolved)) {
        // Direction flip only takes effect on a cold start; tell the
        // user instead of leaving them with a half-flipped layout.
        Alert.alert(
          translateMessage(resolved, "mobile", "profile.restartRequiredTitle"),
          translateMessage(resolved, "mobile", "profile.restartRequiredMessage"),
        );
      }
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      isRTL: isRTL(locale),
      dir: dir(locale),
      t,
      changeLocale,
      resolving,
    }),
    [locale, t, changeLocale, resolving],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}