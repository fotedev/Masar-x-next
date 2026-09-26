import { describe, expect, it } from "vitest";
import {
  combinePromptWithAttachments,
  countLines,
  createPastedAttachment,
  extractInserted,
  shouldWrapAsAttachment,
  PASTE_CHAR_THRESHOLD,
  PASTE_LINE_THRESHOLD,
} from "../paste-attachments";

describe("paste-attachments (spec 024)", () => {
  it("extracts a pure caret insertion", () => {
    const { inserted, stripped } = extractInserted("hello", "hello world");
    expect(inserted).toBe(" world");
    expect(stripped).toBe("hello");
  });

  it("extracts a selection-overwrite paste, preserving context", () => {
    const { inserted, stripped, prefixLength } = extractInserted("hello brave world", "hello PASTE world");
    expect(inserted).toBe("PASTE");
    expect(stripped).toBe("hello  world");
    expect(prefixLength).toBe(6);
  });

  it("yields empty inserted on deletion (passthrough)", () => {
    const { inserted, stripped } = extractInserted("hello world", "hello");
    expect(inserted).toBe("");
    expect(stripped).toBe("hello");
  });

  it("handles identical and empty values", () => {
    expect(extractInserted("abc", "abc").inserted).toBe("");
    expect(extractInserted("", "").inserted).toBe("");
  });

  it("does not wrap small deltas (typing, autocorrect-size swaps)", () => {
    expect(shouldWrapAsAttachment("x")).toBe(false);
    expect(extractInserted("teh cat", "the cat").inserted).toBe("h");
    expect(shouldWrapAsAttachment("the")).toBe(false);
  });

  it(`wraps inserted chunks over ${PASTE_CHAR_THRESHOLD} chars`, () => {
    const big = "x".repeat(PASTE_CHAR_THRESHOLD + 1);
    expect(extractInserted("", big).inserted).toBe(big);
    expect(shouldWrapAsAttachment(big)).toBe(true);
    expect(shouldWrapAsAttachment("x".repeat(PASTE_CHAR_THRESHOLD))).toBe(false);
  });

  it(`wraps inserted chunks over ${PASTE_LINE_THRESHOLD} lines`, () => {
    const lines = Array.from({ length: PASTE_LINE_THRESHOLD + 1 }, (_, i) => `line ${i}`).join("\n");
    expect(countLines(lines)).toBe(PASTE_LINE_THRESHOLD + 1);
    expect(shouldWrapAsAttachment(lines)).toBe(true);
  });

  it("wraps an Arabic multi-line paste", () => {
    const lines = Array.from({ length: PASTE_LINE_THRESHOLD + 2 }, () => "سطر من النص الملصق للاختبار").join("\n");
    const { inserted } = extractInserted("سؤال: ", `سؤال: ${lines}`);
    expect(shouldWrapAsAttachment(inserted)).toBe(true);
  });

  it("creates a named attachment with a size label", () => {
    const att = createPastedAttachment("hello world", 123);
    expect(att.name).toBe("pasted-text-123.txt");
    expect(att.charCount).toBe(11);
    expect(att.sizeLabel).toBe("11 B");
  });

  it("emits the 023 block format byte-identically", () => {
    const att = createPastedAttachment("PASTE_CONTENT", 1);
    expect(combinePromptWithAttachments("summarize this", [att])).toBe(
      "summarize this\n\n[Attached Document: pasted-text-1.txt]\n\nPASTE_CONTENT\n\n[End of Document]",
    );
  });

  it("allows attachments with an empty typed prompt", () => {
    const att = createPastedAttachment("PASTE_CONTENT", 1);
    expect(combinePromptWithAttachments("   ", [att])).toContain("PASTE_CONTENT");
  });
});
