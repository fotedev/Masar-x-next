import { describe, expect, it } from "vitest";
import {
  combinePromptWithAttachments,
  countLines,
  createPastedAttachment,
  shouldWrapAsAttachment,
  PASTE_CHAR_THRESHOLD,
  PASTE_LINE_THRESHOLD,
} from "@/lib/ai/pasted-attachments";

describe("pasted-attachments (spec 022)", () => {
  it("does not wrap small pastes", () => {
    expect(shouldWrapAsAttachment("hello")).toBe(false);
    expect(shouldWrapAsAttachment("a\nb\nc")).toBe(false);
  });

  it(`wraps text over ${PASTE_CHAR_THRESHOLD} chars`, () => {
    expect(shouldWrapAsAttachment("x".repeat(PASTE_CHAR_THRESHOLD + 1))).toBe(true);
    expect(shouldWrapAsAttachment("x".repeat(PASTE_CHAR_THRESHOLD))).toBe(false);
  });

  it(`wraps text over ${PASTE_LINE_THRESHOLD} lines`, () => {
    const lines = Array.from({ length: PASTE_LINE_THRESHOLD + 1 }, (_, i) => `line ${i}`).join("\n");
    expect(countLines(lines)).toBe(PASTE_LINE_THRESHOLD + 1);
    expect(shouldWrapAsAttachment(lines)).toBe(true);
  });

  it("creates a named attachment with size label", () => {
    const att = createPastedAttachment("hello world", 123);
    expect(att.name).toBe("pasted-text-123.txt");
    expect(att.charCount).toBe(11);
    expect(att.sizeLabel).toMatch(/B|KB/);
  });

  it("injects attachments as document blocks, never empty objects", () => {
    const att = createPastedAttachment("PASTE_CONTENT", 1);
    const combined = combinePromptWithAttachments("summarize this", [att]);
    expect(combined).toContain("summarize this");
    expect(combined).toContain("[Attached Document: pasted-text-1.txt]");
    expect(combined).toContain("PASTE_CONTENT");
    expect(combined).toContain("[End of Document]");
  });

  it("allows attachments with an empty typed prompt", () => {
    const att = createPastedAttachment("PASTE_CONTENT", 1);
    const combined = combinePromptWithAttachments("   ", [att]);
    expect(combined).toContain("PASTE_CONTENT");
  });
});
