"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ComponentsLike = Record<string, React.ComponentType<any>>;

export function MarkdownRendererHeavy(props: {
  content: string;
  components?: ComponentsLike;
  className?: string;
}) {
  const { content, components, className } = props;

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
