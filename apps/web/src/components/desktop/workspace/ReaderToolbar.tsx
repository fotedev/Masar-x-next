"use client";

import { useTranslations } from "next-intl";

/**
 * T012 — Toolbar above the document reader.
 *
 * Carries the open-lecture title, a highlight action, a download action,
 * and the assistant toggle (FR-004 / FR-005). Actions are deliberately
 * scoped to this MVP: highlight and download are wired but no-op until
 * the upstream viewer surface exposes a real handler; the assistant
 * toggle is the only stateful control here.
 */

interface ReaderToolbarProps {
  lectureTitle: string | null;
  highlightAvailable: boolean;
  onHighlight: () => void;
  downloadAvailable: boolean;
  onDownload: () => void;
  assistantOpen: boolean;
  onToggleAssistant: () => void;
}

export function ReaderToolbar({
  lectureTitle,
  highlightAvailable,
  onHighlight,
  downloadAvailable,
  onDownload,
  assistantOpen,
  onToggleAssistant,
}: ReaderToolbarProps) {
  const t = useTranslations("desktopStudyWorkspace");

  return (
    <div
      className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur"
      // Chrome only — selection suppressed (FR-013)
      style={{ userSelect: "none" }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("toolbar.label")}
        </span>
        <h3
          className="truncate text-sm font-medium text-foreground"
          // Title text remains copyable for assistive tech, but not user-draggable
          title={lectureTitle ?? t("toolbar.noSelection")}
        >
          {lectureTitle ?? t("toolbar.noSelection")}
        </h3>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onHighlight}
          disabled={!highlightAvailable}
          aria-pressed={false}
          title={t("toolbar.highlightTitle")}
          className="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("toolbar.highlight")}
        </button>

        <button
          type="button"
          onClick={onDownload}
          disabled={!downloadAvailable}
          title={t("toolbar.downloadTitle")}
          className="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("toolbar.download")}
        </button>

        <button
          type="button"
          onClick={onToggleAssistant}
          aria-pressed={assistantOpen}
          title={
            assistantOpen ? t("toolbar.assistantClose") : t("toolbar.assistantOpen")
          }
          data-masarx-assistant-toggle=""
          className={`rounded-md px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            assistantOpen
              ? "bg-accent text-foreground"
              : "text-foreground hover:bg-accent"
          }`}
        >
          {assistantOpen ? t("toolbar.assistantActive") : t("toolbar.assistantInactive")}
        </button>
      </div>
    </div>
  );
}
