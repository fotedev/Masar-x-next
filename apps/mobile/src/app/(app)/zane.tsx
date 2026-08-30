import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { palette, Card, Notice, PrimaryButton } from "@/components/bits";
import { newConversationId, sendZaneMessage, ZaneMessage } from "@/lib/zane";

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `m${Date.now()}-${idCounter}`;
}

export default function ZaneScreen() {
  const [messages, setMessages] = useState<ZaneMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "مرحبًا! أنا زين، المساعد الذكي لمنصة Masar X. اسألني أي شيء عن موادك أو منصتك 🎓",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef(newConversationId());
  const listRef = useRef<FlatList<ZaneMessage>>(null);

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");

    const userMsg: ZaneMessage = { id: nextId(), role: "user", text };
    const pendingId = nextId();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: "assistant", text: "…" },
    ]);
    setBusy(true);

    const { content, error: err } = await sendZaneMessage(text, conversationId.current);

    setMessages((prev) =>
      prev.map((m) =>
        m.id === pendingId
          ? { ...m, text: content ?? (err ?? "حدث خطأ غير متوقع") }
          : m,
      ),
    );
    if (err) setError(err);
    setBusy(false);
  };

  const canSend = input.trim().length > 0 && !busy;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <View style={styles.container}>
        {error ? <Notice kind="warn" text={error} /> : null}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.bubbleWrap, item.role === "user" && styles.userBubbleWrap]}>
              <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.bubbleText, item.role === "user" && styles.userBubbleText]}>
                  {item.text}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={null}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="اكتب سؤالك لزين…"
            placeholderTextColor={palette.textMuted}
            multiline
            maxLength={2000}
          />
          <Pressable
            onPress={() => void onSend()}
            disabled={!canSend}
            hitSlop={8}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.sendPressed,
              (!canSend || busy) && styles.sendDisabled,
            ]}
            accessibilityLabel="إرسال"
          >
            <Text style={styles.sendIcon}>{busy ? "…" : "➤"}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: palette.bg, padding: 12 },
  list: { flex: 1 },
  listContent: { paddingVertical: 8, gap: 8 },
  bubbleWrap: { flexDirection: "row", justifyContent: "flex-start" },
  userBubbleWrap: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 2,
  },
  aiBubble: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  userBubble: { backgroundColor: palette.primary },
  bubbleText: { color: palette.text, fontSize: 15, lineHeight: 22 },
  userBubbleText: { color: "#ffffff" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.bg,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: palette.text,
    textAlignVertical: "center",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendPressed: { opacity: 0.85 },
  sendDisabled: { opacity: 0.4 },
  sendIcon: { color: "#ffffff", fontSize: 17 },
});
