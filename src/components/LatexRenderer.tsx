"use client";

import { type FC } from "react";

import dynamic from "next/dynamic";
import { useMemo } from "react";

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

  const HeavyLatexRenderer = useMemo(
    () =>
      dynamic(() => import("./HeavyLatexRenderer"), {
        ssr: false,
        loading: () => <span className={className}>{input}</span>,
      }),
    // Keep className and input in deps so loading fallback matches latest text.
    [className, input],
  );

  if (!hasLatex) {
    return <span className={className}>{input}</span>;
  }

  return <HeavyLatexRenderer text={input} className={className} />;
};
