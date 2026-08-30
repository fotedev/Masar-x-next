import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Field, Notice, PrimaryButton } from "@/components/bits";

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
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View className="items-center mb-7">
          <Text className="text-3xl font-extrabold text-slate-900">Masar X</Text>
          <Text className="mt-1.5 text-sm text-slate-500">منصة مسار التعليمية — تطبيق الطلاب</Text>
        </View>

        <View className="rounded-xl border border-slate-200 bg-white p-4 mb-3">
          <Text className="text-xl font-bold text-slate-900">تسجيل الدخول</Text>
          <Text className="mb-4 mt-1 text-sm text-slate-500">استخدم حسابك نفسه الذي تستخدمه على الموقع</Text>

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

          <Pressable onPress={onForgot} className="mt-3.5 items-center" disabled={resetting} hitSlop={8}>
            <Text className="text-sm text-blue-600">نسيت كلمة المرور؟</Text>
          </Pressable>

          <Link href="/(auth)/signup" asChild>
            <Pressable className="mt-2 items-center" hitSlop={8}>
              <Text className="text-sm font-bold text-blue-600">ليس لديك حساب؟ إنشاء حساب جديد</Text>
            </Pressable>
          </Link>
        </View>

        <Text className="text-center text-xs text-slate-500 mt-2">v1.2.0 (602)</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 72, paddingBottom: 40 },
});
