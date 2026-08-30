import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { palette } from "@/components/bits";

export default function AppTabsLayout() {
  const { session, loading } = useAuth();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((s) => setOffline(!s.isConnected));
    return () => unsubscribe();
  }, []);

  // Router-level auth gate: unauthenticated users never see app tabs.
  if (!loading && !session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.splashText}>جارٍ التحقق من الجلسة…</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {offline ? (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>لا يوجد اتصال بالإنترنت — سيتم التحديث عند عودة الشبكة</Text>
        </View>
      ) : null}
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTitleAlign: "center",
          headerTitleStyle: { fontWeight: "700" },
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.textMuted,
          sceneStyle: { backgroundColor: palette.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "الرئيسية",
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="subjects"
          options={{
            title: "المواد",
            tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="summaries"
          options={{
            title: "الملخصات",
            tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="zane"
          options={{
            title: "المساعد",
            tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="news"
          options={{
            title: "الأخبار",
            tabBarIcon: ({ color, size }) => <Ionicons name="megaphone" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "حسابي",
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", gap: 12 },
  splashText: { color: palette.textMuted, fontSize: 15 },
  offlineBar: { backgroundColor: palette.warningBg, paddingVertical: 8, paddingHorizontal: 16 },
  offlineText: { color: palette.warningText, fontSize: 13, textAlign: "center" },
});
