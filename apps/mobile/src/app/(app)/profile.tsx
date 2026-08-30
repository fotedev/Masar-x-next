import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { palette, Card, Chip, PrimaryButton } from "@/components/bits";

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();

  const onSignOut = () => {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من التطبيق؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "خروج", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  const name = profile?.full_name?.trim();
  const academic = [
    typeof profile?.level === "number" ? `المستوى ${profile.level}` : null,
    typeof profile?.semester === "number" ? `الفصل ${profile.semester}` : null,
  ].filter(Boolean) as string[];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.container, { paddingTop: 16 }]}>
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
        {academic.length > 0 ? (
          <View style={styles.chipsRow}>
            {academic.map((chip) => (
              <Chip key={chip} text={chip} />
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>عن التطبيق</Text>
        <Text style={styles.body}>
          التطبيق الأصلي لمنصة Masar X — يعرض موادك وملخصاتك وأخبار المنصة مباشرة من حسابك.
        </Text>
        <Text style={styles.version}>الإصدار 1.0.0 (600) · Expo / React Native</Text>
      </Card>

      <PrimaryButton label="تسجيل الخروج" variant="danger" onPress={onSignOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  container: { paddingHorizontal: 16, paddingBottom: 24 },
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
  chipsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: palette.text, marginBottom: 6 },
  body: { fontSize: 13, lineHeight: 21, color: palette.text },
  version: { fontSize: 12, color: palette.textMuted, marginTop: 10 },
});
