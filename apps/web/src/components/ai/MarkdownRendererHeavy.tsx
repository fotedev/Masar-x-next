"use client";


import "highlight.js/styles/github-dark.css";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// Spec 036 Track B: module-scope constants keep the plugin-array identities
// stable across renders. A streaming bubble passes `streaming` to skip the
// highlight pass entirely — re-highlighting the growing text once per frame
// is the expensive part; the finalize render highlights exactly once.
const HIGHLIGHT_REHYPE_PLUGINS = [rehypeHighlight];
const EMPTY_REHYPE_PLUGINS: never[] = [];

export function MarkdownRendererHeavy(props: {
  content: string;
  components?: Components;
  className?: string;
  /** True while this bubble is still receiving streamed deltas (spec 036). */
  streaming?: boolean;
}) {
  const { content, components, className, streaming = false } = props;

  return (
    <div className={className}>
      <ReactMarkdown
        // remark-breaks: single newlines become <br/> — model output rarely
        // uses blank lines reliably, so "text:\n3. item" must not merge into
        // one run-on paragraph.
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={streaming ? EMPTY_REHYPE_PLUGINS : HIGHLIGHT_REHYPE_PLUGINS}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
