import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth";
import { fetchNotifications, markNotificationsRead } from "@/lib/api";
import { palette, Card, EmptyState, ErrorState, ListSkeleton } from "@/components/bits";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId as string),
    enabled: Boolean(userId),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const rows = query.data ?? [];
  const unread = rows.filter((n) => !n.read).length;

  const markAll = async () => {
    if (!userId) return;
    await markNotificationsRead(userId);
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} tintColor="#2563eb" />}
    >
      {query.isError ? (
        <ErrorState message="تعذّر تحميل الإشعارات" onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد إشعارات" subtitle="ستظهر إشعارات المنصة هنا مباشرة عند وصولها" />
      ) : (
        <>
          {unread > 0 ? (
            <Pressable onPress={() => void markAll()} className="mb-3 self-start rounded-lg bg-blue-50 px-3 py-2" hitSlop={6}>
              <Text className="text-sm font-semibold text-blue-700">تحديد الكل كمقروء ({unread})</Text>
            </Pressable>
          ) : null}
          {rows.map((n) => (
            <Card key={n.id} style={n.read ? undefined : { borderColor: "#bfdbfe", backgroundColor: "#f8faff" }}>
              <View style={styles.headRow}>
                <Text style={styles.title}>{n.title}</Text>
                {!n.read ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.message}>{n.message}</Text>
              <Text style={styles.date}>{fmtDate(n.created_at)}</Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 24 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: palette.text },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary },
  message: { fontSize: 13, lineHeight: 20, color: palette.text, marginTop: 4 },
  date: { fontSize: 11, color: palette.textMuted, marginTop: 6 },
});
