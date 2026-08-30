import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

export const palette = {
  bg: "#f8fafc",
  surface: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  danger: "#dc2626",
  warningBg: "#fff7ed",
  warningText: "#9a3412",
  star: "#f59e0b",
};

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "danger" | "ghost";
}) {
  const bg =
    variant === "danger" ? palette.danger : variant === "ghost" ? "transparent" : palette.primary;
  const fg = variant === "ghost" ? palette.textMuted : "#ffffff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        variant === "ghost" && styles.buttonGhost,
        pressed && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  secure,
  keyboard,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secure?: boolean;
  keyboard?: TextInputProps["keyboardType"];
  placeholder?: string;
  autoComplete?: TextInputProps["autoComplete"];
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.fieldInput}
      />
    </View>
  );
}

export function Notice({ kind, text }: { kind: "error" | "info" | "warn"; text: string }) {
  const bg = kind === "error" ? "#fef2f2" : kind === "warn" ? palette.warningBg : "#eff6ff";
  const color =
    kind === "error" ? palette.danger : kind === "warn" ? palette.warningText : palette.primaryDark;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Text style={[styles.noticeText, { color }]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.emptyTitle, { color: palette.danger }]}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryLink}>
          <Text style={{ color: palette.primary }}>إعادة المحاولة</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={[styles.skeletonBar, { width: "70%" }]} />
          <View style={[styles.skeletonBar, { width: "40%", height: 12 }]} />
        </View>
      ))}
      <ActivityIndicator style={{ marginTop: 16 }} color={palette.primary} />
    </View>
  );
}

export function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 12,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonGhost: { borderWidth: 1, borderColor: palette.border },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 14, color: palette.textMuted, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 16,
    color: palette.text,
    textAlignVertical: "center",
  },
  notice: { borderRadius: 12, padding: 12, marginBottom: 12 },
  noticeText: { fontSize: 14, lineHeight: 21 },
  center: { alignItems: "center", padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: palette.text, textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: palette.textMuted, marginTop: 6, textAlign: "center" },
  retryLink: { marginTop: 12, padding: 8 },
  skeletonRow: { padding: 16, backgroundColor: palette.surface, borderRadius: 14, marginBottom: 12 },
  skeletonBar: { height: 16, borderRadius: 8, backgroundColor: "#e2e8f0", marginBottom: 8 },
  chip: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  chipText: { color: palette.primaryDark, fontSize: 12, fontWeight: "600" },
});
