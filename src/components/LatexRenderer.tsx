"use client";

import React from "react";
// import "katex/dist/katex.min.css";

interface LatexRendererProps {
  text: string;
  className?: string;
}

export const LatexRenderer: React.FC<LatexRendererProps> = ({
  text,
  className = "",
}) => {
  // Temporary bypass for debugging
  return <span className={className}>{text}</span>;
};
