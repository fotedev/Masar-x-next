"use client";

import dynamic from "next/dynamic";
import { type Components } from "react-markdown";

// Created once at module scope (spec 011): the previous per-render useMemo
// recreated the dynamic wrapper on every content change, remounting the whole
// ReactMarkdown tree — unworkable once replies stream in chunk by chunk.
// Content/components flow through as props after the single chunk load.
const Heavy = dynamic(
  () => import("@/components/ai/MarkdownRendererHeavy").then((m) => m.MarkdownRendererHeavy),
  { ssr: false, loading: () => <div className="min-h-[1.5em]" /> },
);

export function LazyMarkdown(props: {
  content: string;
  components?: Components;
  className?: string;
}) {
  const { content, components, className } = props;

  return <Heavy content={content} components={components} className={className} />;
}
