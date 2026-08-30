import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { supabase, SITE_URL } from "@/lib/supabase";
import { palette, Card, Field, Notice, PrimaryButton } from "@/components/bits";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const canSubmit =
    fullName.trim().length >= 2 &&
    EMAIL_RX.test(email.trim()) &&
    password.length >= 6 &&
    password === confirm;

  const validate = (): string | null => {
    if (fullName.trim().length < 2) return "أدخل اسمك الكامل";
    if (!EMAIL_RX.test(email.trim())) return "أدخل بريدًا إلكترونيًا صحيحًا";
    if (password.length < 6) return "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    if (password !== confirm) return "كلمتا المرور غير متطابقتين";
    return null;
  };

  const onSubmit = async () => {
    setError(null);
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${SITE_URL}/ar/login`,
        data: { full_name: fullName.trim() },
      },
    });
    setSubmitting(false);

    if (err) {
      if (err.message.includes("already registered")) {
        setError("هذا البريد الإلكتروني مسجل مسبقًا — سجّل الدخول بدلًا من ذلك");
      } else if (err.message.includes("rate limit")) {
        setError("محاولات كثيرة — انتظر قليلًا ثم أعد المحاولة");
      } else {
        setError("تعذّر إنشاء الحساب، حاول مجددًا");
      }
      return;
    }

    if (data.session) {
      // Email confirmations are disabled on this project: user is in immediately.
      router.replace("/(app)");
      return;
    }
    // Confirmation email flow: the user confirms on the web, then signs in here.
    setConfirmSent(true);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.brandName}>Masar X</Text>
          <Text style={styles.brandTag}>إنشاء حساب جديد</Text>
        </View>

        <Card>
          {error ? <Notice kind="error" text={error} /> : null}
          {confirmSent ? (
            <Notice
              kind="info"
              text="تم إنشاء حسابك! راجع بريدك الإلكتروني واضغط رابط التأكيد، ثم سجّل الدخول من هنا."
            />
          ) : null}

          <Field label="الاسم الكامل" value={fullName} onChangeText={setFullName} placeholder="اسمك كما تريد ظهوره" />
          <Field
            label="البريد الإلكتروني"
            value={email}
            onChangeText={setEmail}
            keyboard="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Field label="كلمة المرور" value={password} onChangeText={setPassword} secure autoComplete="new-password" placeholder="6 أحرف على الأقل" />
          <Field label="تأكيد كلمة المرور" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" placeholder="أعد كتابة كلمة المرور" />

          <PrimaryButton label="إنشاء الحساب" onPress={onSubmit} disabled={!canSubmit && !submitting} loading={submitting} />

          <Link href="/(auth)/sign-in" asChild>
            <Pressable style={styles.link} hitSlop={8}>
              <Text style={styles.linkText}>لدي حساب بالفعل — تسجيل الدخول</Text>
            </Pressable>
          </Link>
        </Card>

        <Card style={styles.noteCard}>
          <Text style={styles.noteText}>
            ملاحظة: بعد إنشاء الحساب، سيتم مزامنة ملفك الشخصي تلقائيًا عند أول تسجيل دخول.
          </Text>
        </Card>

        <Text style={styles.footer}>v1.1.0 (601)</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  brand: { alignItems: "center", marginBottom: 24 },
  brandName: { fontSize: 30, fontWeight: "800", color: palette.text },
  brandTag: { marginTop: 6, fontSize: 14, color: palette.textMuted },
  link: { alignItems: "center", marginTop: 14 },
  linkText: { color: palette.primary, fontSize: 14 },
  noteCard: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  noteText: { color: palette.primaryDark, fontSize: 13, lineHeight: 20, textAlign: "center" },
  footer: { textAlign: "center", color: palette.textMuted, fontSize: 12, marginTop: 8 },
});
