"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { type Components } from "react-markdown";

export function LazyMarkdown(props: {
  content: string;
  components?: Components;
  className?: string;
}) {
  const { content, components, className } = props;

  const Heavy = useMemo(
    () =>
      dynamic(
        () => import("@/components/ai/MarkdownRendererHeavy").then((m) => m.MarkdownRendererHeavy),
        {
          ssr: false,
          loading: () => <div className={className}>{content}</div>,
        },
      ),
    [className, content],
  );

  return <Heavy content={content} components={components} className={className} />;
}
