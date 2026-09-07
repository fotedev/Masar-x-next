"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { ContentItem } from "@/hooks/useLectureContent";

/**
 * T013 — Embedded document reader surface.
 *
 * Three explicit states (FR-009):
 *  - "no-selection" — invitation copy (when no lecture is open)
 *  - "no-document" — the open lecture has no document attached
 *  - "load-failure-with-retry" — the embedded iframe failed to load
 *
 * Selecting a different lecture swaps the rendered content IN PLACE
 * (no navigation, no reload) per FR-003. The toolbar above carries the
 * meta / actions; this file owns the document body and its own scroll.
 */

interface DocumentReaderProps {
  lectureTitle: string | null;
  /** First file-like content for the active lecture, if any. */
  document: ContentItem | null;
  /** Whether the host content hook is still loading. */
  loading?: boolean;
}

export function DocumentReader({ lectureTitle, document, loading }: DocumentReaderProps) {
  const t = useTranslations("desktopStudyWorkspace");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Reset failure on document change — retry applies to the next attempt.
  useEffect(() => {
    setLoadFailed(false);
  }, [document?.id, document?.file_url]);

  const handleRetry = useCallback(() => {
    setLoadFailed(false);
    setReloadKey((k) => k + 1);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"
          aria-label={t("reader.loading")}
        />
      </div>
    );
  }

  if (!lectureTitle) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center"
        style={{ userSelect: "none" }}
      >
        <p className="text-base font-medium text-foreground">
          {t("reader.emptyTitle")}
        </p>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {t("reader.emptyBody")}
        </p>
      </div>
    );
  }

  if (!document || !document.file_url) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center"
        style={{ userSelect: "none" }}
      >
        <p className="text-base font-medium text-foreground">
          {t("reader.noDocumentTitle")}
        </p>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {t("reader.noDocumentBody", { lecture: lectureTitle })}
        </p>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center"
        style={{ userSelect: "none" }}
      >
        <p className="text-base font-medium text-foreground">
          {t("reader.loadErrorTitle")}
        </p>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {t("reader.loadErrorBody")}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("reader.retry")}
        </button>
      </div>
    );
  }

  return (
    <iframe
      key={reloadKey}
      ref={iframeRef}
      src={document.file_url}
      // Embedded document — sandboxing relaxed only to keep the platform's
      // own viewer functional; cross-origin docs still isolate. FR-009
      // explicit states; this is the success body.
      title={document.title || lectureTitle}
      className="h-full w-full border-0 bg-background"
      onError={() => setLoadFailed(true)}
      // The toolbar / parent already names the lecture; the iframe
      // surfaces document-internal anchors via its own UI.
    />
  );
}
