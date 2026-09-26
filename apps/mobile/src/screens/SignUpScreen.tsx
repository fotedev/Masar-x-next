/**
 * Sign-up screen (spec 019 C3/T084): email + password + confirm, the
 * plain supabase.auth.signUp call the web signup form uses (no
 * options — the confirmation-email flow; no auto-login). Success shows
 * the confirmation-sent notice and returns the user to Login. Errors
 * are mapped by lib/signup-validation (already-registered vs generic).
 *
 * Strings come from the shared `authPages` namespace (web-owned);
 * no MOBILE_STRINGS additions were needed.
 */
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
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

import type { RootStackParamList } from "../../app/App";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import type { Palette } from "../lib/theme";
import { mapSignupError, validateSignup } from "../lib/signup-validation";

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const { t, isRTL } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const onSubmit = async () => {
    if (submitting) return;
    const errorKey = validateSignup(email, password, confirmPassword);
    if (errorKey) {
      setError(t("authPages", errorKey));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signUp(email.trim(), password);
      // Confirmation-email flow (web parity): no auto-login — the user
      // verifies via the email link, then signs in on the Login screen.
      setConfirmationSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(t("authPages", mapSignupError(message)));
    } finally {
      setSubmitting(false);
    }
  };

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
        <Text style={[styles.tagline, isRTL && styles.rtlText]}>
          {t("authPages", "signupSubtitle")}
        </Text>

        {confirmationSent ? (
          <View style={styles.form}>
            <Text style={[styles.sentText, isRTL && styles.rtlText]}>
              {t("authPages", "signupConfirmationSent")}
            </Text>
            <Pressable
              style={styles.button}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText}>
                {t("authPages", "goToLogin")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.title, isRTL && styles.rtlText]}>
              {t("authPages", "signupTitle")}
            </Text>

            <Text style={styles.label}>{t("authPages", "emailLabel")}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.subtle}
            />

            <Text style={styles.label}>{t("authPages", "passwordLabel")}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            <Text style={styles.label}>
              {t("authPages", "confirmPasswordLabel")}
            </Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            {error ? (
              <Text style={[styles.error, isRTL && styles.rtlText]}>{error}</Text>
            ) : null}

            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>
                  {t("authPages", "signUp")}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.linkButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.linkText}>
                {t("authPages", "alreadyHaveAccountPrompt")}{" "}
                {t("authPages", "goToLogin")}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: { flexGrow: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  brand: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: 8,
  },
  tagline: {
    color: colors.subtle,
    textAlign: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
    textAlign: "center",
  },
  form: { width: "100%", maxWidth: 420 },
  label: {
    color: colors.ink,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
  },
  error: { color: colors.danger, marginTop: 12, textAlign: "center" },
  sentText: {
    color: colors.ink,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.onPrimary, fontWeight: "700", fontSize: 16 },
  linkButton: { alignItems: "center", marginTop: 18 },
  linkText: { color: colors.primary, fontWeight: "600", textAlign: "center" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
});
