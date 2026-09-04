/**
 * Login screen (spec FR-014): Supabase email/password sign-in through
 * AuthContext.signIn, with inline error mapping and a loading state.
 *
 * Google OAuth is DEFERRED for v1 (spec US4 / T046): native Google
 * sign-in needs an AS/OAuth browser session plus a deep-link callback;
 * the screen shows a "coming later" note instead of a dead button.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

const COLORS = {
  primary: "#4F46E5",
  ink: "#111827",
  subtle: "#6B7280",
  bg: "#F8FAFC",
  danger: "#DC2626",
  border: "#CBD5E1",
};

export default function LoginScreen() {
  const { status, signIn, retry } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (submitting) return;
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signIn(trimmed, password);
      // AuthContext flips to "authenticated" via onAuthStateChange.
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/invalid login|invalid credentials|invalid username|email not confirmed/i.test(message)) {
        setError(t("mobile", "login.invalidCredentials"));
      } else if (/failed to fetch|network|fetch failed|timed?\s?out/i.test(message)) {
        setError(t("mobile", "login.networkError"));
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "unconfigured") {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.brand}>Masar X</Text>
        <Text style={styles.unconfiguredText}>{t("mobile", "offline.retryWhenOnline")}</Text>
        <Pressable style={styles.button} onPress={retry}>
          <Text style={styles.buttonText}>{t("mobile", "common.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.screen,
          styles.center,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>Masar X</Text>
        <Text style={styles.tagline}>{t("subjects", "description")}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t("auth", "email")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={COLORS.subtle}
          />

          <Text style={styles.label}>{t("auth", "password")}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t("auth", "signIn")}</Text>
            )}
          </Pressable>

          {/* Google OAuth deferred for v1 (spec US4 / T046). */}
          <Text style={styles.oauthNote}>{t("mobile", "login.googleDeferred")}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  screen: { flexGrow: 1, backgroundColor: COLORS.bg },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  brand: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.primary,
    marginBottom: 8,
  },
  tagline: {
    color: COLORS.subtle,
    textAlign: "center",
    marginBottom: 32,
  },
  form: { width: "100%", maxWidth: 420 },
  label: {
    color: COLORS.ink,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.ink,
  },
  error: { color: COLORS.danger, marginTop: 12, textAlign: "center" },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  oauthNote: {
    color: COLORS.subtle,
    textAlign: "center",
    marginTop: 16,
    fontSize: 13,
  },
  unconfiguredText: {
    color: COLORS.ink,
    textAlign: "center",
    marginBottom: 20,
  },
});