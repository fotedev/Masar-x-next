// Spec 049 — conversation helper unit tests (pure logic, node env).
import { describe, expect, it } from "vitest";
import {
  CONVERSATION_TITLE_MAX,
  deriveConversationTitle,
  pickCurrentConversation,
} from "../chat-conversations";
import type { Conversation } from "@/types/database";

const mkConv = (id: string, updatedAt: string): Conversation => ({
  id,
  user_id: "u-1",
  mode: "cs_assistant",
  title: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: updatedAt,
});

describe("deriveConversationTitle", () => {
  it("keeps a short message as-is", () => {
    expect(deriveConversationTitle("ما هو BST؟")).toBe("ما هو BST؟");
    expect(deriveConversationTitle("explain quicksort")).toBe("explain quicksort");
  });

  it("collapses whitespace to single spaces", () => {
    expect(deriveConversationTitle("line1\n\nline2   line3")).toBe("line1 line2 line3");
  });

  it("truncates long messages with an ellipsis at the cap", () => {
    const long = "a".repeat(200);
    const title = deriveConversationTitle(long);
    expect(title).toHaveLength(CONVERSATION_TITLE_MAX + 1); // cap + ellipsis
    expect(title!.endsWith("…")).toBe(true);
    expect(title!.startsWith("a".repeat(CONVERSATION_TITLE_MAX))).toBe(true);
  });

  it("trims trailing whitespace before the ellipsis", () => {
    const title = deriveConversationTitle(`${"a".repeat(59)}   b`);
    expect(title).toBe(`${"a".repeat(59)}…`);
  });

  it("keeps a message of exactly the cap length unchanged", () => {
    const exact = "b".repeat(CONVERSATION_TITLE_MAX);
    expect(deriveConversationTitle(exact)).toBe(exact);
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(deriveConversationTitle("")).toBeNull();
    expect(deriveConversationTitle("   \n\t  ")).toBeNull();
  });
});

describe("pickCurrentConversation", () => {
  it("returns null for an empty list", () => {
    expect(pickCurrentConversation([])).toBeNull();
  });

  it("returns the single row", () => {
    const row = mkConv("c-1", "2026-01-02T00:00:00.000Z");
    expect(pickCurrentConversation([row])).toBe(row);
  });

  it("picks the most recently updated row regardless of order", () => {
    const older = mkConv("c-old", "2026-01-01T00:00:00.000Z");
    const newer = mkConv("c-new", "2026-01-03T00:00:00.000Z");
    // Deliberately unsorted input — the pick must not rely on query order.
    expect(pickCurrentConversation([newer, older])!.id).toBe("c-new");
    expect(pickCurrentConversation([older, newer])!.id).toBe("c-new");
  });

  it("breaks updated_at ties deterministically on id", () => {
    const a = mkConv("c-a", "2026-01-02T00:00:00.000Z");
    const b = mkConv("c-b", "2026-01-02T00:00:00.000Z");
    expect(pickCurrentConversation([b, a])!.id).toBe("c-b");
    expect(pickCurrentConversation([a, b])!.id).toBe("c-b");
  });
});
