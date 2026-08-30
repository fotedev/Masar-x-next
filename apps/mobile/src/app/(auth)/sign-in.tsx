import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { palette, Card, Field, Notice, PrimaryButton } from "@/components/bits";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignInScreen() {
  const { signIn, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  const canSubmit = EMAIL_RX.test(email.trim()) && password.length >= 6;

  const onSubmit = async () => {
    setError(null);
    setResetSent(false);
    if (!canSubmit) {
      setError("أدخل بريدًا إلكترونيًا صحيحًا وكلمة مرور من 6 أحرف على الأقل");
      return;
    }
    setSubmitting(true);
    const { error: err } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    // supabase-js emits SIGNED_IN (session set) before this resolves, so the
    // (app) auth gate is satisfied when the replace lands.
    router.replace("/(app)");
  };

  const onForgot = async () => {
    setError(null);
    setResetSent(false);
    if (!EMAIL_RX.test(email.trim())) {
      setError("أدخل بريدك الإلكتروني أولًا ثم اضغط مرة أخرى لإرسال رابط الاستعادة");
      return;
    }
    setResetting(true);
    const { error: err } = await resetPassword(email.trim());
    setResetting(false);
    if (err) setError(err);
    else setResetSent(true);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.brandName}>Masar X</Text>
          <Text style={styles.brandTag}>منصة مسار التعليمية — تطبيق الطلاب</Text>
        </View>

        <Card>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.subtitle}>استخدم حسابك نفسه الذي تستخدمه على الموقع</Text>

          {error ? <Notice kind="error" text={error} /> : null}
          {resetSent ? (
            <Notice kind="info" text="تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني" />
          ) : null}

          <Field
            label="البريد الإلكتروني"
            value={email}
            onChangeText={setEmail}
            keyboard="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Field
            label="كلمة المرور"
            value={password}
            onChangeText={setPassword}
            secure
            autoComplete="password"
            placeholder="••••••••"
          />

          <PrimaryButton label="دخول" onPress={onSubmit} disabled={!canSubmit} loading={submitting} />

          <Pressable onPress={onForgot} style={styles.link} disabled={resetting}>
            <Text style={styles.linkText}>نسيت كلمة المرور؟</Text>
          </Pressable>
        </Card>

        <Card style={styles.signupCard}>
          <Text style={styles.signupText}>لا تملك حسابًا؟ أنشئ حسابك من موقع Masar X ثم سجّل الدخول هنا.</Text>
        </Card>

        <Text style={styles.footer}>v1.0.0 (600)</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 20, paddingTop: 72, paddingBottom: 40 },
  brand: { alignItems: "center", marginBottom: 28 },
  brandName: { fontSize: 30, fontWeight: "800", color: palette.text },
  brandTag: { marginTop: 6, fontSize: 14, color: palette.textMuted },
  title: { fontSize: 20, fontWeight: "700", color: palette.text },
  subtitle: { fontSize: 14, color: palette.textMuted, marginTop: 4, marginBottom: 16 },
  link: { alignItems: "center", marginTop: 14 },
  linkText: { color: palette.primary, fontSize: 14 },
  signupCard: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  signupText: { color: palette.primaryDark, fontSize: 13, lineHeight: 20, textAlign: "center" },
  footer: { textAlign: "center", color: palette.textMuted, fontSize: 12, marginTop: 8 },
});
