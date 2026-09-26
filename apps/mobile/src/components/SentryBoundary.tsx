/**
 * Root crash boundary (spec 023).
 *
 * Wraps the app shell so render errors in any screen are captured by
 * Sentry and the user sees the themed retry UI instead of a white
 * screen. Mounted inside the provider stack (I18n/Theme) so the
 * fallback can translate and theme itself; strings reuse the shared
 * `errorBoundary` namespace - no mobile-only strings added.
 *
 * The visual pattern mirrors UnconfiguredScreen in app/App.tsx
 * (centered brand + message + retry button, Palette-based light/dark
 * styles). The technical error itself is never rendered - it already
 * went to Sentry.
 */
import * as Sentry from "@sentry/react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import { darkColors, lightColors, type Palette } from "../lib/theme";

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  const { resolved } = useTheme();
  const styles = resolved === "dark" ? darkStyles : lightStyles;
  return (
    <View style={styles.center}>
      <Text style={styles.brand}>Masar X</Text>
      <Text style={styles.message}>{t("errorBoundary", "title")}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>{t("errorBoundary", "retry")}</Text>
      </Pressable>
    </View>
  );
}

export default function SentryBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => <ErrorFallback onRetry={resetError} />}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
      padding: 24,
    },
    brand: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.primary,
      marginBottom: 12,
    },
    message: {
      color: colors.ink,
      textAlign: "center",
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    retryButtonText: { color: colors.onPrimary, fontWeight: "700" },
  });

const lightStyles = createStyles(lightColors);
const darkStyles = createStyles(darkColors);
