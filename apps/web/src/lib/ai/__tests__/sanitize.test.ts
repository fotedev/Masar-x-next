import { describe, expect, it } from "vitest";
import {
  sanitizeAssistantReply,
  stripOpeningGreeting,
  userMessageLooksLikeGreeting,
} from "../sanitize";

describe("userMessageLooksLikeGreeting", () => {
  it("detects Arabic and English greetings", () => {
    expect(userMessageLooksLikeGreeting("hi")).toBe(true);
    expect(userMessageLooksLikeGreeting("Hello")).toBe(true);
    expect(userMessageLooksLikeGreeting("السلام عليكم")).toBe(true);
    expect(userMessageLooksLikeGreeting("مرحبا")).toBe(true);
    expect(userMessageLooksLikeGreeting("أهلاً")).toBe(true);
  });

  it("documents the edge: bare 'Hello!' with punctuation is NOT detected (current behavior)", () => {
    // The exact-match branch checks 'hello' (no punctuation); only
    // 'hello ' (with a trailing space) is prefix-matched. Locked as-is.
    expect(userMessageLooksLikeGreeting("Hello!")).toBe(false);
  });

  it("rejects real questions even with greeting words embedded mid-sentence (en)", () => {
    // 'hi '/'hello ' must be a PREFIX, not anywhere.
    expect(userMessageLooksLikeGreeting("explain this hi")).toBe(false);
    expect(userMessageLooksLikeGreeting("what is 2+2?")).toBe(false);
    expect(userMessageLooksLikeGreeting("")).toBe(false);
  });
});

describe("stripOpeningGreeting", () => {
  it("strips a leading Arabic greeting with suffixes", () => {
    expect(stripOpeningGreeting("مرحباً بك! كيف أساعدك؟")).toBe("كيف أساعدك؟");
    expect(stripOpeningGreeting("أهلاً وسهلاً — سؤالك؟")).toBe("سؤالك؟");
  });

  it("strips a leading English greeting", () => {
    expect(stripOpeningGreeting("Hi there! How can I help?")).toBe(
      "there! How can I help?",
    );
    expect(stripOpeningGreeting("Hello!")).toBe("");
  });

  it("leaves non-greeting text untouched", () => {
    expect(stripOpeningGreeting("The mitochondria is the powerhouse.")).toBe(
      "The mitochondria is the powerhouse.",
    );
  });

  it("only strips the greeting — keeps the body (regression: mid-text سلام survives)", () => {
    const out = stripOpeningGreeting("مرحبا، عندك سؤال عن السلام والسلام عليكم؟");
    expect(out).not.toMatch(/^مرحبا/);
    expect(out).toContain("السلام");
  });
});

describe("sanitizeAssistantReply (fenced code)", () => {
  it("wraps a leading run of indented code lines into a fenced block", () => {
    const reply = [
      "Here is the fix:",
      "",
      "    const x = 1;",
      "    return x;",
      "",
      "That's it.",
    ].join("\n");
    const out = sanitizeAssistantReply("explain", reply);
    expect(out).toContain("```");
    expect(out).toContain("const x = 1;");
    // Fence comes before the code, closing fence before the prose tail.
    expect(out.indexOf("```")).toBeLessThan(out.indexOf("const x = 1;"));
  });

  it("detects keyword-led code lines (const/function/def)", () => {
    const reply = "Sure:\nconst a = compute();\nreturn a;\nDone.";
    const out = sanitizeAssistantReply("q", reply);
    expect(out).toContain("```");
  });

  it("never touches text that already has fences", () => {
    const reply = "Use:\n```js\nconst a = 1;\n```\nend";
    expect(sanitizeAssistantReply("q", reply)).toBe(reply);
  });

  it("keeps the greeting when the user's message IS a greeting", () => {
    const reply = "أهلاً بك! تفضل سؤالك.";
    // query is a greeting → the reply's own greeting is preserved.
    expect(sanitizeAssistantReply("مرحبا", reply)).toContain("أهلاً");
  });

  it("strips the reflexive greeting when the query is a direct question", () => {
    const reply = "أهلاً! الإجابة هي 42.";
    const out = sanitizeAssistantReply("ما هي الإجابة؟", reply);
    expect(out).not.toMatch(/^أهلاً/);
    expect(out).toContain("42");
  });

  it("returns empty input as-is", () => {
    expect(sanitizeAssistantReply("q", "")).toBe("");
  });
});
