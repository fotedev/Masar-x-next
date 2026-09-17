"use client";


import "highlight.js/styles/github-dark.css";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function MarkdownRendererHeavy(props: {
  content: string;
  components?: Components;
  className?: string;
}) {
  const { content, components, className } = props;

  return (
    <div className={className}>
      <ReactMarkdown
        // remark-breaks: single newlines become <br/> — model output rarely
        // uses blank lines reliably, so "text:\n3. item" must not merge into
        // one run-on paragraph.
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
