/**
 * Pure text repairs applied to ZANE assistant markdown BEFORE parsing.
 * All of them fix recurring shapes in real model output that CommonMark
 * refuses to interpret the way the model (and the reader) intends.
 * Fenced code blocks are excluded from every repair — code must survive
 * byte-for-byte. Keep these functions pure so they stay unit-testable.
 */

// Map LaTeX display/inline delimiters onto the $$ / $ forms LatexRenderer
// understands. The old string templates silently lost the math body here —
// "$$1$" parses as literal `$1$`, never referencing the capture group.
export const normalizeLatexDelimiters = (text: string): string => {
  return String(text ?? "")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, body: string) => `$${body}$`);
};

// CommonMark treats `** نص **` (space just inside the delimiters) as
// literal text, so Arabic model output leaks raw `**` into the bubble.
// Trim the inner padding so it parses as bold. Fenced code blocks are
// excluded — `a ** b ** c` inside code must stay untouched.
export const repairSpacedBold = (text: string): string => {
  return String(text ?? "")
    .split(/(```[\s\S]*?```)/g)
    .map((segment) =>
      segment.startsWith("```")
        ? segment
        : segment.replace(/\*\*(\s+)([^*]+?)(\s+)\*\*/g, "**$2**"),
    )
    .join("");
};

// Models omit the space around `**` markers (`عايزه**متعدد الصفحات**`). The
// current remark (CommonMark 0.31) still parses that as bold, but the DOM
// then holds the two runs with no space between them, so in an RTL bubble
// the final ه visually collides with the bold text (spec 012, item 2 —
// AST-probe verified, not a flanking-parsing bug). Insert the missing space
// ONLY where a letter or digit sits against a bold span's boundary:
// punctuation stays attached (`ملاحظة:**نص**`, `**done.**`), and unpaired
// `**` is never touched. Fenced code excluded.
const GLUED_BOLD_OPENER = /([\p{L}\p{N}])(\*\*[^*\n]+?\*\*)/gu;
const GLUED_BOLD_CLOSER = /(\*\*[^*\n]+?\*\*)([\p{L}\p{N}])/gu;

export const repairBoldBoundaries = (text: string): string => {
  return String(text ?? "")
    .split(/(```[\s\S]*?```)/g)
    .map((segment) =>
      segment.startsWith("```")
        ? segment
        : segment
            .replace(GLUED_BOLD_OPENER, "$1 $2")
            .replace(GLUED_BOLD_CLOSER, "$1 $2"),
    )
    .join("");
};

const ORDERED_MARKER = /^\s*(\d{1,2})\.\s/;
// Short label ending in ":", glued straight onto a numbered marker —
// `مرتبة:1. تحليل المشكلة`. The marker lands mid-line, so the line parses
// as a paragraph and every following `N.` line can't interrupt it (a list
// may interrupt a paragraph only when it starts with "1."), collapsing the
// whole sequence into one run-on paragraph.
const LABEL_GLUED_MARKER = /^([^:\n]{1,60}):\s*(\d{1,2})\.\s+(.+)$/;
const LABEL_LINE = /:\s*$/;
// Models frequently drop the hyphen from GFM task items (`[x] مهمة` at
// line start), which renders the marker as literal text glued onto the
// previous list item. A line-leading bare `[ ]`/`[x]`/`[X]` followed by a
// space is unambiguously a task item, so restore the bullet.
const BARE_TASK_MARKER = /^(\[[ xX]\] )/;
const FENCE_SPLIT = /(```[\s\S]*?```)/g;

const nextNonEmptyLine = (lines: string[], from: number): string | undefined => {
  for (let j = from; j < lines.length; j += 1) {
    if (lines[j].trim() !== "") return lines[j];
  }
  return undefined;
};

// Model output glues list markers to the preceding text. Two shapes:
// 1. `label:N. item` with numbered lines continuing below — split the
//    marker onto its own paragraph so CommonMark sees a list (works for
//    any start number).
// 2. A bare `label:` line followed directly by `N. item` with N ≠ 1 —
//    insert the blank line the list needs to start (N = 1 already
//    interrupts a paragraph, so it is left untouched to keep lists tight).
// Also pads a line-leading hyphen glued to its text (`-**Bold**`) with the
// space the bullet marker requires, and restores the hyphen on bare
// line-leading task markers. Dashes (`---`), negative numbers and
// `->` arrows are excluded.
export const repairListGlue = (text: string): string => {
  return String(text ?? "")
    .split(FENCE_SPLIT)
    .map((segment) => {
      if (segment.startsWith("```")) return segment;
      const lines = segment.split("\n");
      const out: string[] = [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const glued = line.match(LABEL_GLUED_MARKER);
        const nextLine = nextNonEmptyLine(lines, i + 1);
        if (glued && nextLine !== undefined && ORDERED_MARKER.test(nextLine)) {
          out.push(`${glued[1]}:`, "", `${glued[2]}. ${glued[3]}`);
          continue;
        }
        if (LABEL_LINE.test(line) && nextLine !== undefined) {
          const startNumber = ORDERED_MARKER.exec(nextLine)?.[1];
          if (startNumber !== undefined && startNumber !== "1") {
            out.push(line, "");
            continue;
          }
        }
        out.push(
          line
            .replace(BARE_TASK_MARKER, "- $1")
            .replace(/^-(?![-\s\d>])/, "- "),
        );
      }
      return out.join("\n");
    })
    .join("");
};
