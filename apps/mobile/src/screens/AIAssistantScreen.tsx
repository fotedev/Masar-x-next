/**
 * AI Tutor chat (spec US3 / ai-boundary contract): every message goes
 * through the Supabase Edge Function via src/lib/ai.ts - the app never
 * talks to an AI provider directly. Assistant responses render through
 * MathText so LaTeX math displays.
 *
 * Offline: a banner explains the state ("offline, will retry"); a send
 * that fails keeps a per-message retry affordance. v1 uses the
 * non-streaming sendAiMessageMobile round-trip; the streaming variant
 * (streamAiMessageMobile in lib/ai.ts) is ready for a follow-up pass.
 *
 * Known backend gap (see lib/ai.ts header): until the shared client
 * attaches an Authorization header, the Edge Function may answer 401 -
 * surfaced as a normal failed bubble with retry, never as a crash.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MathText from "../components/MathText";
import { useI18n } from "../context/I18nContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { createAiRequest, isAiConfigured, sendAiMessageMobile } from "../lib/ai";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  failed?: boolean;
  /** Original user text, kept for the retry affordance on failures. */
  retryText?: string;
}

const COLORS = {
  card: "#FFFFFF",
  primary: "#4F46E5",
  ink: "#111827",
  subtle: "#6B7280",
  bg: "#F8FAFC",
  border: "#E2E8F0",
  banner: "#FEF3C7",
  bannerText: "#92400E",
  danger: "#DC2626",
};

export default function AIAssistantScreen() {
  const { t, locale } = useI18n();
  const { online } = useNetworkStatus();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  // Cancel any in-flight request when the screen unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sending) return;

      if (!isAiConfigured()) {
        setMessages((prev) => [
          ...prev,
          { id: `u${Date.now()}`, role: "user", text },
          {
            id: `a${Date.now()}`,
            role: "assistant",
            text: t("mobile", "offline.retryWhenOnline"),
            failed: true,
            retryText: text,
          },
        ]);
        return;
      }

      const assistantId = `a${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: `u${Date.now()}`, role: "user", text },
        { id: assistantId, role: "assistant", text: "", pending: true },
      ]);
      setInput("");
      setSending(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const request = createAiRequest(text, locale);
        const response = await sendAiMessageMobile(request, { signal: controller.signal });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: response.content, pending: false } : m,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const offlineish =
          !online || /failed to fetch|network|fetch failed|timed?\s?out|401/i.test(message);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  pending: false,
                  failed: true,
                  text: offlineish ? t("mobile", "offline.aiQueued") : message,
                  retryText: text,
                }
              : m,
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [sending, t, locale, online],
  );

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.bubbleRow,
        item.role === "user" ? styles.rowUser : styles.rowAssistant,
      ]}
    >
      <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant]}>
        {item.role === "assistant" && !item.failed ? (
          item.pending ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <MathText text={item.text} rtl={locale === "ar"} />
          )
        ) : (
          <Text
            style={item.role === "user" ? styles.userText : styles.assistantText}
            selectable
          >
            {item.text}
          </Text>
        )}
        {item.failed && item.retryText ? (
          <Pressable style={styles.retryChip} onPress={() => void send(item.retryText ?? "")}>
            <Text style={styles.retryChipText}>{t("mobile", "common.retry")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const listHeader = (
    <View style={styles.welcome}>
      <Text style={styles.welcomeTitle}>{t("aiAssistant", "welcomeTitle")}</Text>
      <Text style={styles.disclaimer}>{t("aiAssistant", "aiDisclaimer")}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("mobile", "tabs.ai")}</Text>
        {messages.length > 0 ? (
          <Pressable onPress={() => setMessages([])} hitSlop={8}>
            <Text style={styles.clearText}>{t("aiAssistant", "clearChat")}</Text>
          </Pressable>
        ) : null}
      </View>

      {!online ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t("mobile", "offline.aiQueued")}</Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={messages.length === 0 ? listHeader : null}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t("aiAssistant", "inputPlaceholderMobile")}
            placeholderTextColor="#94A3B8"
            multiline
          />
          <Pressable
            style={[styles.sendButton, (sending || !input.trim()) && styles.sendDisabled]}
            onPress={() => void send(input)}
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendText}>{t("aiAssistant", "send")}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: COLORS.ink },
  clearText: { color: COLORS.primary, fontWeight: "600" },
  banner: {
    backgroundColor: COLORS.banner,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  bannerText: { color: COLORS.bannerText, fontSize: 13, fontWeight: "600" },
  list: { padding: 16, paddingBottom: 24 },
  welcome: { alignItems: "center", paddingVertical: 24 },
  welcomeTitle: { fontSize: 18, fontWeight: "700", color: COLORS.ink, textAlign: "center" },
  disclaimer: {
    color: COLORS.subtle,
    textAlign: "center",
    marginTop: 8,
    marginHorizontal: 12,
    fontSize: 13,
  },
  bubbleRow: { flexDirection: "row", marginBottom: 10 },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "85%",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bubbleUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  userText: { color: "#FFFFFF", fontSize: 15 },
  assistantText: { color: COLORS.ink, fontSize: 15, lineHeight: 22 },
  retryChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  retryChipText: { color: COLORS.primary, fontWeight: "700", fontSize: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    color: COLORS.ink,
    fontSize: 15,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: "#FFFFFF", fontWeight: "700" },
});