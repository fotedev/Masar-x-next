"use client";


import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRendererHeavy(props: {
  content: string;
  components?: Components;
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
