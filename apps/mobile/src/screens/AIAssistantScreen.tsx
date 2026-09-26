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
 * History (spec 019 C5): conversations persist locally
 * (lib/chat-history.ts, key outside the read-cache prefix) so they
 * survive an app restart. Writes are EVENT-driven (repo lesson
 * 2026-09-16 #14): a pendingPersistRef is raised only by real
 * send/finalize/failure events and consumed once by the persist
 * effect — mount, clear, and auth transitions write nothing; deletion
 * happens exclusively in clearChat.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MathText from "../components/MathText";
import { useI18n } from "../context/I18nContext";
import { useTheme } from "../context/ThemeContext";
import type { Palette } from "../lib/theme";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { createAiRequest, isAiConfigured, sendAiMessageMobile } from "../lib/ai";
import {
  AI_PROMPT_MAX_CHARS,
  combinePromptWithAttachments,
  createPastedAttachment,
  extractInserted,
  shouldWrapAsAttachment,
  type PastedAttachment,
} from "../lib/paste-attachments";
import {
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
} from "../lib/chat-history";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  failed?: boolean;
  /** Original user text, kept for the retry affordance on failures. */
  retryText?: string;
}

export default function AIAssistantScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { online } = useNetworkStatus();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Smart Paste (spec 024): large pasted chunks become attachments held
  // alongside the typed input; `notice` surfaces the oversize guard.
  const [attachments, setAttachments] = useState<PastedAttachment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<ChatMessage> | null>(null);

  // Cancel any in-flight request when the screen unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Spec 019 C5 — EVENT-DRIVEN persistence (lesson 2026-09-16 #14):
  // the ref is raised ONLY by real send/finalize/failure events and
  // consumed once by the effect below. Mount, load-from-history, clear,
  // and auth transitions leave it false, so they never trigger a write;
  // deletion is exclusive to clearChat.
  const pendingPersistRef = useRef(false);
  const queuePersist = useCallback(() => {
    pendingPersistRef.current = true;
  }, []);

  // Restore the persisted conversation once on mount. Loading sets
  // state WITHOUT raising the persist flag — a pure read must not
  // rewrite the store.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const history = await loadChatHistory();
      if (!cancelled && history.length > 0) {
        setMessages(history.map((m) => ({ ...m, pending: false })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingPersistRef.current) return;
    pendingPersistRef.current = false;
    void saveChatHistory(messages);
  }, [messages]);

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sending) return;

      if (!isAiConfigured()) {
        queuePersist();
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
      queuePersist();
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
        queuePersist();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, text: response.content, pending: false } : m,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const offlineish =
          !online || /failed to fetch|network|fetch failed|timed?\s?out|401/i.test(message);
        queuePersist();
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

  // Spec 024 — diff-based paste detection (plan.md §2). Native TextInput
  // has no onPaste event: every keystroke, autocorrect swap, IME commit,
  // and paste arrives here as a prev→next transition. Only a transition
  // whose inserted chunk clears the shared thresholds becomes an
  // attachment; everything else takes today's setInput path untouched.
  const handleChangeText = useCallback(
    (next: string) => {
      setNotice(null);
      setSelection(undefined);
      const { inserted, stripped, prefixLength } = extractInserted(input, next);
      if (inserted && shouldWrapAsAttachment(inserted)) {
        setInput(stripped);
        setAttachments((prev) => [...prev, createPastedAttachment(inserted)]);
        // Park the caret where the chunk was lifted out.
        setSelection({ start: prefixLength, end: prefixLength });
        return;
      }
      setInput(next);
    },
    [input],
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      // Don't clobber the one-frame caret restore above with the echo
      // of the pre-strip position.
      setSelection((prev) => (prev ? prev : e.nativeEvent.selection));
    },
    [],
  );

  const canSend = input.trim().length > 0 || attachments.length > 0;

  const sendCurrent = useCallback(() => {
    const combined = combinePromptWithAttachments(input, attachments);
    if (combined.length > AI_PROMPT_MAX_CHARS) {
      setNotice(t("aiAssistant", "promptTooLong"));
      return;
    }
    setAttachments([]);
    setNotice(null);
    void send(combined);
  }, [input, attachments, send, t]);

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
            <ActivityIndicator size="small" color={colors.primary} />
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
          <Pressable
            onPress={() => {
              // Deletion is EXCLUSIVE to clear (spec 019 C5): empty the
              // state without raising the persist flag, and remove the
              // stored key so nothing is rewritten afterwards.
              setMessages([]);
              setAttachments([]);
              setNotice(null);
              void clearChatHistory();
            }}
            hitSlop={8}
          >
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

        <View style={styles.composerWrap}>
        {attachments.length > 0 ? (
          <View style={styles.chipsRow}>
            {attachments.map((att) => (
              <View key={att.id} style={styles.chip}>
                <View style={styles.chipTextWrap}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {t("aiAssistant", "pastedText")}
                  </Text>
                  <Text style={styles.chipSub} numberOfLines={1}>
                    {att.sizeLabel} • {att.charCount} {t("aiAssistant", "pastedChars")}
                  </Text>
                </View>
                <Pressable
                  style={styles.chipRemove}
                  accessibilityLabel={t("aiAssistant", "removeAttachment")}
                  hitSlop={8}
                  onPress={() =>
                    setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                  }
                >
                  <Text style={styles.chipRemoveText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {notice ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={handleChangeText}
            onSelectionChange={handleSelectionChange}
            selection={selection}
            placeholder={t("aiAssistant", "inputPlaceholderMobile")}
            placeholderTextColor={colors.placeholder}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (sending || !canSend) && styles.sendDisabled]}
            onPress={sendCurrent}
            disabled={sending || !canSend}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.sendText}>{t("aiAssistant", "send")}</Text>
            )}
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.bg,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.ink },
  clearText: { color: colors.primary, fontWeight: "600" },
  banner: {
    backgroundColor: colors.banner,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  bannerText: { color: colors.bannerText, fontSize: 13, fontWeight: "600" },
  list: { padding: 16, paddingBottom: 24 },
  welcome: { alignItems: "center", paddingVertical: 24 },
  welcomeTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, textAlign: "center" },
  disclaimer: {
    color: colors.subtle,
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
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleAssistant: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  userText: { color: "#FFFFFF", fontSize: 15 },
  assistantText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  retryChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  retryChipText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: colors.card,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 4,
    gap: 8,
  },
  chipTextWrap: { flexShrink: 1, maxWidth: 220 },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.ink },
  chipSub: { fontSize: 11, color: colors.subtle },
  chipRemove: { padding: 4 },
  chipRemoveText: { fontSize: 13, fontWeight: "800", color: colors.primary },
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    color: colors.ink,
    fontSize: 15,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: "#FFFFFF", fontWeight: "700" },
});