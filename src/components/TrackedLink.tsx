import React from "react";
import { ExternalLink } from "lucide-react";
import { useAnalytics } from "../hooks/useAnalytics";

interface TrackedLinkProps {
  href: string;
  children: React.ReactNode;
  contentType: string; // e.g., 'course_link', 'pdf_link', 'exam_info'
  contentId?: string;
  metadata?: Record<string, any>;
  className?: string;
  target?: "_blank" | "_self";
}

export const TrackedLink: React.FC<TrackedLinkProps> = ({
  href,
  children,
  contentType,
  contentId,
  metadata,
  className = "",
  target = "_blank",
}) => {
  const { trackClick } = useAnalytics();

  const handleClick = async () => {
    await trackClick(contentType, contentId, {
      url: href,
      ...metadata,
    });
  };

  return (
    <a
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors ${className}`}
    >
      {children}
      {target === "_blank" && <ExternalLink size={14} />}
    </a>
  );
};
