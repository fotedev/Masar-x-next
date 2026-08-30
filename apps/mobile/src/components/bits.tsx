import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

// NativeWind (Tailwind) primitives shared by every screen.
// Reading-first design: zero decoration, system font, clear hierarchy.

export function Card({ children, style, className }: { children: React.ReactNode; style?: object; className?: string }) {
  return <View className={`rounded-xl border border-slate-200 bg-white p-4 mb-3 ${className ?? ""}`} style={style}>{children}</View>;
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
  const bg = variant === "danger" ? "bg-red-600" : variant === "ghost" ? "bg-transparent" : "bg-blue-600";
  const fg = variant === "ghost" ? "text-slate-500" : "text-white";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`min-h-[48px] items-center justify-center rounded-xl px-4 active:opacity-85 ${bg} ${
        variant === "ghost" ? "border border-slate-200" : ""
      } ${(disabled || loading) ? "opacity-50" : ""}`}
    >
      {loading ? <ActivityIndicator color={fg === "text-white" ? "#ffffff" : "#64748b"} /> : <Text className={`text-base font-semibold ${fg}`}>{label}</Text>}
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
    <View className="mb-3.5">
      <Text className="mb-1.5 text-sm text-slate-500">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect={false}
        className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900"
      />
    </View>
  );
}

export function Notice({ kind, text }: { kind: "error" | "info" | "warn"; text: string }) {
  const bg = kind === "error" ? "bg-red-50" : kind === "warn" ? "bg-orange-50" : "bg-blue-50";
  const color = kind === "error" ? "text-red-600" : kind === "warn" ? "text-orange-800" : "text-blue-800";
  return (
    <View className={`mb-3 rounded-xl p-3 ${bg}`}>
      <Text className={`text-sm leading-5 ${color}`}>{text}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="items-center p-6">
      <Text className="text-center text-base font-semibold text-slate-900">{title}</Text>
      {subtitle ? <Text className="mt-1.5 text-center text-sm text-slate-500">{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="items-center p-6">
      <Text className="text-center text-base font-semibold text-red-600">{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} className="mt-3 p-2" hitSlop={8}>
          <Text className="text-blue-600">إعادة المحاولة</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="mb-3 rounded-xl bg-white p-4">
          <View className="mb-2 h-4 w-2/3 rounded-lg bg-slate-200" />
          <View className="h-3 w-2/5 rounded-lg bg-slate-200" />
        </View>
      ))}
      <ActivityIndicator className="mt-4" color="#2563eb" />
    </View>
  );
}

export function Chip({ text }: { text: string }) {
  return (
    <View className="self-start rounded-full bg-blue-50 px-2.5 py-1">
      <Text className="text-xs font-semibold text-blue-800">{text}</Text>
    </View>
  );
}

// Kept for screens not yet migrated to NativeWind classes.
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

export const styles = StyleSheet.create({});
