import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { upsertProfileFields } from "@/lib/api";
import { palette, Card, Chip, PrimaryButton } from "@/components/bits";

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const onSignOut = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من التطبيق؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  const setAcademic = async (patch: { level?: number; semester?: number }) => {
    if (!user) return;
    try {
      await upsertProfileFields({
        id: user.id,
        level: patch.level ?? (typeof profile?.level === "number" ? profile.level : undefined),
        semester: patch.semester ?? (typeof profile?.semester === "number" ? profile.semester : undefined),
      });
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    } catch {
      Alert.alert("تعذّر الحفظ", "حاول مرة أخرى");
    }
  };

  const name = profile?.full_name?.trim();

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={styles.container}>
      <Card>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(name || user?.email || "؟").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.name}>{name || "طالب Masar X"}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>إعدادك الأكاديمي</Text>
        <Text style={styles.hint}>يحدد المواد التي تظهر لك في تبويب المواد (مثل الموقع)</Text>
        <Text style={styles.pickerLabel}>المستوى</Text>
        <View style={styles.chipsRow}>
          {[1, 2, 3, 4].map((lv) => (
            <Pressable
              key={lv}
              onPress={() => void setAcademic({ level: lv })}
              className={`rounded-xl border px-4 py-2.5 ${profile?.level === lv ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}
              accessibilityRole="button"
              accessibilityLabel={`المستوى ${lv}`}
            >
              <Text style={{ color: profile?.level === lv ? palette.primaryDark : palette.textMuted, fontWeight: "600" }}>
                المستوى {lv}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.pickerLabel}>الفصل الدراسي</Text>
        <View style={styles.chipsRow}>
          {[1, 2].map((se) => (
            <Pressable
              key={se}
              onPress={() => void setAcademic({ semester: se })}
              className={`rounded-xl border px-4 py-2.5 ${profile?.semester === se ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}
              accessibilityRole="button"
              accessibilityLabel={`الفصل ${se}`}
            >
              <Text style={{ color: profile?.semester === se ? palette.primaryDark : palette.textMuted, fontWeight: "600" }}>
                الفصل {se}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Pressable onPress={() => router.push("/(app)/notifications")} hitSlop={6} accessibilityRole="button">
          <View style={styles.linkRow}>
            <Text style={styles.linkIcon}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>الإشعارات</Text>
              <Text style={styles.linkSubtitle}>إشعارات المنصة والمراجعات</Text>
            </View>
            <Text style={styles.linkArrow}>‹</Text>
          </View>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>عن التطبيق</Text>
        <Text style={styles.body}>
          التطبيق الأصلي لمنصة Masar X — موادك وملخصاتك وأخبار المنصة والاختبارات والمساعد زين، مباشرة من حسابك.
        </Text>
        <Text style={styles.version}>الإصدار 1.2.0 (602) · Expo / React Native</Text>
      </Card>

      <PrimaryButton label="تسجيل الخروج" variant="danger" onPress={onSignOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 22, fontWeight: "800" },
  headerTexts: { flex: 1 },
  name: { fontSize: 18, fontWeight: "800", color: palette.text },
  email: { fontSize: 13, color: palette.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: palette.text, marginBottom: 6 },
  hint: { fontSize: 12, color: palette.textMuted, marginBottom: 10 },
  pickerLabel: { fontSize: 13, color: palette.textMuted, marginTop: 8, marginBottom: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  body: { fontSize: 13, lineHeight: 21, color: palette.text },
  version: { fontSize: 12, color: palette.textMuted, marginTop: 10 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  linkIcon: { fontSize: 22 },
  linkTitle: { fontSize: 15, fontWeight: "700", color: palette.text },
  linkSubtitle: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  linkArrow: { fontSize: 22, color: palette.textMuted },
});
