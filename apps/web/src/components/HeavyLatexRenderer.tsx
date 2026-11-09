"use client";


import { Fragment, useMemo } from "react";
import "katex/dist/katex.min.css";
import katex from "katex";

interface HeavyLatexRendererProps {
  text: string;
  className?: string;
}

// Direct katex.renderToString — react-katex is gone (peer-pinned katex ^0.16,
// blocking the 0.18+ security floor). throwOnError: false renders malformed
// model-output LaTeX as error-styled source instead of crashing the bubble.
// KaTeX's default settings never emit raw HTML/links (trust: false), so the
// markup injected below is katex-generated and safe.
const renderMath = (value: string, displayMode: boolean): string =>
  katex.renderToString(value, { displayMode, throwOnError: false });

export default function HeavyLatexRenderer({
  text,
  className = "",
}: HeavyLatexRendererProps) {
  const parts = useMemo(() => {
    const segments: Array<
      | { type: "text"; value: string }
      | { type: "inline"; value: string }
      | { type: "block"; value: string }
    > = [];

    const input = String(text ?? "");
    const blockRegex = /\$\$([\s\S]+?)\$\$/g;
    let lastIndex = 0;

    for (const match of input.matchAll(blockRegex)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const before = input.slice(lastIndex, start);
      if (before) segments.push({ type: "text", value: before });
      segments.push({ type: "block", value: match[1] ?? "" });
      lastIndex = end;
    }

    const remaining = input.slice(lastIndex);
    if (remaining) segments.push({ type: "text", value: remaining });

    return segments;
  }, [text]);

  const renderInline = (value: string) => {
    const inlineParts: Array<
      { type: "text"; value: string } | { type: "inline"; value: string }
    > = [];

    const inlineRegex = /\$([^$\n]+?)\$/g;
    let iLast = 0;
    for (const m of value.matchAll(inlineRegex)) {
      const s = m.index ?? 0;
      const e = s + m[0].length;
      const b = value.slice(iLast, s);
      if (b) inlineParts.push({ type: "text", value: b });
      inlineParts.push({ type: "inline", value: m[1] ?? "" });
      iLast = e;
    }
    const rem = value.slice(iLast);
    if (rem) inlineParts.push({ type: "text", value: rem });

    return inlineParts.map((p, idx) => {
      if (p.type === "inline") {
        return (
          <span
            key={idx}
            dangerouslySetInnerHTML={{ __html: renderMath(p.value, false) }}
          />
        );
      }
      return <Fragment key={idx}>{p.value}</Fragment>;
    });
  };

  return (
    // dir="ltr" (HTML dir implies bidi isolation) keeps formulas intact
    // inside Arabic bubbles — KaTeX's CSS ships no direction rule, so
    // without this the math inherits the bubble's rtl and renders mirrored
    // (`E = mc^2` came out as `²mc = E`).
    <span className={className} dir="ltr">
      {parts.map((p, idx) => {
        if (p.type === "block") {
          return (
            <span
              key={idx}
              dangerouslySetInnerHTML={{ __html: renderMath(p.value, true) }}
            />
          );
        }
        return <Fragment key={idx}>{renderInline(p.value)}</Fragment>;
      })}
    </span>
  );
}
