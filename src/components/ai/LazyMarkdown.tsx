"use client";

import dynamic from "next/dynamic";
import React, { useMemo } from "react";

type ComponentsLike = Record<string, React.ComponentType<any>>;

export function LazyMarkdown(props: {
  content: string;
  components?: ComponentsLike;
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
