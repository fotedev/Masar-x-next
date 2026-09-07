"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { User } from "@supabase/supabase-js";
import { LectureListColumn } from "./LectureListColumn";
import { ReaderToolbar } from "./ReaderToolbar";
import { DocumentReader } from "./DocumentReader";
import { AssistantPanel } from "./AssistantPanel";
import type { StudyWorkspaceProps } from "./types";

/**
 * T015 — Three-column desktop study workspace composer.
 *
 * One window, three regions side by side (FR-001). Column order uses
 * logical inline-start/inline-end so RTL and LTR mirror correctly
 * without hardcoding physical sides (FR-008). No window-level scroll
 * per FR-017: the wrapper is `h-full overflow-hidden`, and every region
 * owns its own internal scroll.
 *
 * Responsibilities owned here:
 *  - The selection state (which lecture is open, whether the assistant
 *    is open). Hosts re-render as selection changes — no router push,
 *    no navigation (FR-003 / Edge Cases).
 *  - Producing the "scope" for the assistant from the open lecture.
 *
 * Responsibilities NOT owned here:
 *  - The data fetch (the host wires `useLectureContent` and passes the
 *    matching content slice into `currentContent`).
 *  - The actual document bytes — the reader embeds whatever URL the
 *    host supplies.
 */

interface StudyWorkspaceComponentProps extends StudyWorkspaceProps {
  user: User | null;
  trackEvent: (eventName: string, metadata?: Record<string, unknown>) => void;
}

export function StudyWorkspace({
  subjectName,
  lectures,
  initialLectureId,
  currentContent,
  contentLoading,
  onSelectLecture,
  user,
  trackEvent,
}: StudyWorkspaceComponentProps) {
  const t = useTranslations("desktopStudyWorkspace");

  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(() => {
    if (initialLectureId && lectures.some((l) => l.id === initialLectureId)) {
      return initialLectureId;
    }
    return lectures[0]?.id ?? null;
  });

  const [assistantOpen, setAssistantOpen] = useState(false);

  const handleSelect = useCallback(
    (lectureId: string) => {
      setSelectedLectureId(lectureId);
      onSelectLecture?.(lectureId);
    },
    [onSelectLecture],
  );

  const handleToggleAssistant = useCallback(() => {
    setAssistantOpen((current) => !current);
  }, []);

  const handleCloseAssistant = useCallback(() => {
    setAssistantOpen(false);
  }, []);

  const handleHighlight = useCallback(() => {
    // MVP scope: surface a status signal only. In T015 we keep the action
    // honest by NOT pretending to highlight — the future highlight feature
    // owns the actual selection-write path.
    trackEvent("study_workspace_highlight_clicked", { lectureId: selectedLectureId });
  }, [trackEvent, selectedLectureId]);

  const handleDownload = useCallback(() => {
    const activeLecture = lectures.find((l) => l.id === selectedLectureId);
    const url = activeLecture?.documentUrl;
    if (!url) return;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    trackEvent("study_workspace_download_clicked", { lectureId: selectedLectureId });
  }, [lectures, selectedLectureId, trackEvent]);

  const activeLecture = useMemo(
    () => lectures.find((l) => l.id === selectedLectureId) ?? null,
    [lectures, selectedLectureId],
  );

  const activeDocument = useMemo(() => {
    if (!currentContent || !activeLecture) return null;
    if (activeLecture.documentUrl) {
      return (
        currentContent.files.find(
          (file) => file.file_url === activeLecture.documentUrl,
        ) ?? currentContent.files[0] ?? null
      );
    }
    return currentContent.files[0] ?? null;
  }, [currentContent, activeLecture]);

  // Scope the assistant by the open lecture so the header can display it
  // and `FR-006` ("assistant updates to the newly selected lecture") holds.
  const assistantScope = useMemo(
    () => ({
      subjectName,
      lectureTitle: activeLecture?.title ?? null,
      lectureId: activeLecture?.id ?? null,
    }),
    [subjectName, activeLecture],
  );

  return (
    <div
      role="application"
      aria-label={t("aria.workspace", { subject: subjectName })}
      // h-full + overflow-hidden = no window-level scroll (FR-017)
      className="flex h-full w-full min-h-0 flex-row overflow-hidden bg-background"
      // RTL/LTR is handled by `dir` on the document; on the shell we
      // place the lecture list at logical inline-start and the assistant
      // at logical inline-end using flex with `order:` so the browser
      // mirrors correctly per reading direction.
    >
      {/* Lecture list — inline-start.
          In LTR the row renders left → right, so this lands on the left.
          In RTL (dir=rtl) it lands on the right. No physical sides. */}
      <div
        // Order 1 on the inline-start side
        className="order-1 flex h-full w-72 shrink-0 flex-col border-e border-border bg-muted/30"
      >
        <LectureListColumn
          lectures={lectures}
          activeLectureId={selectedLectureId}
          onSelect={handleSelect}
          subjectName={subjectName}
        />
      </div>

      {/* Reader — fills remaining space, order 2 (middle). */}
      <div className="order-2 flex h-full min-w-0 flex-1 flex-col">
        <ReaderToolbar
          lectureTitle={activeLecture?.title ?? null}
          highlightAvailable={!!activeDocument}
          onHighlight={handleHighlight}
          downloadAvailable={!!activeLecture?.documentUrl}
          onDownload={handleDownload}
          assistantOpen={assistantOpen}
          onToggleAssistant={handleToggleAssistant}
        />
        <div className="min-h-0 flex-1">
          <DocumentReader
            lectureTitle={activeLecture?.title ?? null}
            document={activeDocument}
            loading={contentLoading}
          />
        </div>
      </div>

      {/* Assistant — inline-end. Always mounted, hidden when closed so
          the layout width is reclaimed (acceptance scenario #5 in spec).
          In RTL the inline end is the LEFT side of the screen; in LTR
          it's the RIGHT side. `order-3` keeps the column visually at the
          end regardless of text direction, because flex `order` is
          directional and the platform already sets `dir`. */}
      <div
        className={`order-3 flex h-full w-96 shrink-0 flex-col transition-[width] duration-200 ${
          assistantOpen ? "" : "w-0 overflow-hidden"
        }`}
      >
        <AssistantPanel
          open={assistantOpen}
          onClose={handleCloseAssistant}
          scope={assistantScope}
          user={user}
          trackEvent={trackEvent}
        />
      </div>
    </div>
  );
}
