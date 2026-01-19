import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  text: string;
  className?: string;
}

export const LatexRenderer: React.FC<LatexRendererProps> = ({ text, className = '' }) => {
  const renderedContent = useMemo(() => {
    if (!text) return null;

    // Support $, \( \), and \[ \] delimiters
    // Regex matches:
    // 1. $...$ (inline)
    // 2. \(...\) (inline)
    // 3. \[...\] (block)
    const regex = /(\$[^$]+\$|\\\(.*?\\\)|\\\[.*?\\\])/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      const isInlineMath = (part.startsWith('$') && part.endsWith('$')) || 
                          (part.startsWith('\\(') && part.endsWith('\\)'));
      const isBlockMath = part.startsWith('\\[') && part.endsWith('\\]');

      if (isInlineMath || isBlockMath) {
        // Extract content between delimiters
        let math = '';
        if (part.startsWith('$')) math = part.slice(1, -1);
        else if (part.startsWith('\\(')) math = part.slice(2, -2);
        else if (part.startsWith('\\[')) math = part.slice(2, -2);

        try {
          const html = katex.renderToString(math, {
            throwOnError: false,
            displayMode: isBlockMath,
          });
          return (
            <span
              key={index}
              dangerouslySetInnerHTML={{ __html: html }}
              className={isBlockMath ? "block my-4 overflow-x-auto" : "inline-block mx-1"}
            />
          );
        } catch (error) {
          console.error('KaTeX rendering error:', error);
          return <span key={index} className="text-red-500">{part}</span>;
        }
      }
      return <span key={index}>{part}</span>;
    });
  }, [text]);

  return <span dir="auto" className={`latex-content ${className}`}>{renderedContent}</span>;
};
