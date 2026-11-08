"use client";

import { type FC } from "react";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// Created once at module scope (same pattern as LazyMarkdown): the previous
// per-instance useMemo recreated the dynamic wrapper on every content change,
// remounting the whole KaTeX tree. text/className flow through as props after
// the single chunk load; the loading fallback is static because it runs before
// any props are available.
const HeavyLatexRenderer = dynamic(() => import("./HeavyLatexRenderer"), {
  ssr: false,
  loading: () => <span />,
});

interface LatexRendererProps {
  text: string;
  className?: string;
}

export const LatexRenderer: FC<LatexRendererProps> = ({
  text,
  className = "",
}) => {
  const input = String(text ?? "");

  const hasLatex = useMemo(() => {
    // Detect common math delimiters: $$...$$ or $...$.
    // Keep this cheap; the heavy renderer will do the full parse.
    if (!input) return false;
    if (input.includes("$$")) return true;
    return /\$[^$\n]+?\$/.test(input);
  }, [input]);

  if (!hasLatex) {
    return <span className={className}>{input}</span>;
  }

  // HeavyLatexRenderer's root carries dir="ltr" — math must not inherit the
  // surrounding bubble direction.
  return <HeavyLatexRenderer text={input} className={className} />;
};
