import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { palette, Card } from "@/components/bits";

const QUICK_LINKS = [
  { href: "/(app)/subjects" as const, title: "المواد الدراسية", subtitle: "تصفح مواد تخصصك", icon: "📘" },
  { href: "/(app)/summaries" as const, title: "الملخصات", subtitle: "أعلى الملخصات تقييمًا", icon: "📝" },
  { href: "/(app)/news" as const, title: "الأخبار", subtitle: "آخر إعلانات المنصة", icon: "📣" },
];

export default function HomeScreen() {
  const { user, profile } = useAuth();

  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "طالبنا";

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.container, { paddingTop: 16 }]}>
      <Card style={styles.hero}>
        <Text style={styles.hello}>أهلًا بك، {displayName} 👋</Text>
        <Text style={styles.heroSub}>تطبيق Masar X — كل ما تحتاجه في مسارك الجامعي</Text>
      </Card>

      {QUICK_LINKS.map((item) => (
        <Link key={item.href} href={item.href} asChild>
          <Card style={styles.linkCard}>
            <View style={styles.linkRow}>
              <Text style={styles.linkIcon}>{item.icon}</Text>
              <View style={styles.linkTexts}>
                <Text style={styles.linkTitle}>{item.title}</Text>
                <Text style={styles.linkSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.linkArrow}>‹</Text>
            </View>
          </Card>
        </Link>
      ))}

      <Text style={styles.note}>هذه النسخة الأولى من التطبيق الأصلي — المزيد من المزايا قادم (الاختبارات، الملفات، المساعد الذكي).</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  container: { paddingHorizontal: 16, paddingBottom: 24 },
  hero: { backgroundColor: palette.primary, borderColor: palette.primaryDark },
  hello: { color: "#ffffff", fontSize: 20, fontWeight: "800" },
  heroSub: { color: "#dbeafe", marginTop: 6, fontSize: 14 },
  linkCard: { paddingVertical: 14 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  linkIcon: { fontSize: 26 },
  linkTexts: { flex: 1 },
  linkTitle: { fontSize: 16, fontWeight: "700", color: palette.text },
  linkSubtitle: { fontSize: 13, color: palette.textMuted, marginTop: 2 },
  linkArrow: { fontSize: 24, color: palette.textMuted },
  note: { color: palette.textMuted, fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 8 },
});
