"use client";

import { useEffect, useRef, useState, useCallback, type ClipboardEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { User } from "@supabase/supabase-js";
import { FileText, X } from "lucide-react";
import { toast } from "sonner";
import { useAiChat } from "@/hooks/useAiChat";
import {
  AI_PROMPT_MAX_CHARS,
  combinePromptWithAttachments,
  createPastedAttachment,
  shouldWrapAsAttachment,
  type PastedAttachment,
} from "@/lib/ai/pasted-attachments";

/**
 * T014 — Collapsible assistant panel scoped to the open lecture.
 *
 * Wires the same `useAiChat` hook the standalone Zane page uses
 * (apps/web/src/app/[locale]/ai-assistant/page.tsx). The scope line
 * identifies the lecture currently bound to the conversation and
 * follows selection changes (FR-006). Transcript scrolls only within
 * the panel; the composer stays anchored (Edge Cases).
 *
 * Notes:
 *  - The conversation itself is intentionally NOT scoped server-side
 *    per the spec — the message stream is bound to the lecture only
 *    at send time (and surfaced to the student by the scope label).
 *  - `select-text` is opted back in for transcript content per FR-014,
 *    overriding the global chrome-level selection suppression.
 */

interface AssistantPanelProps {
  open: boolean;
  onClose: () => void;
  scope: {
    subjectName: string;
    lectureTitle: string | null;
    lectureId: string | null;
  };
  user: User | null;
  trackEvent: (eventName: string, metadata?: Record<string, unknown>) => void;
}

export function AssistantPanel({ open, onClose, scope, user, trackEvent }: AssistantPanelProps) {
  const t = useTranslations("desktopStudyWorkspace");
  const {
    messages,
    isLoading,
    sendMessage,
  } = useAiChat(user, trackEvent);

  const [draft, setDraft] = useState("");
  // Smart Paste Canvas parity with the standalone chat (spec 023): large
  // pastes become attachment chips held alongside the typed draft.
  const [pastedAttachments, setPastedAttachments] = useState<PastedAttachment[]>([]);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-stick to the bottom of the transcript when new messages arrive.
  useEffect(() => {
    const container = transcriptRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    if (isNearBottom || isLoading) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // The send path owns no event: the form's onSubmit and the composer's
  // Enter-to-send shortcut both delegate here, so no KeyboardEvent needs
  // to masquerade as a FormEvent.
  const submitDraft = useCallback(async (): Promise<void> => {
    if ((!draft.trim() && pastedAttachments.length === 0) || isLoading) return;
    const content = combinePromptWithAttachments(draft, pastedAttachments);
    if (content.length > AI_PROMPT_MAX_CHARS) {
      toast.error(t("assistant.promptTooLong"));
      return;
    }
    setDraft("");
    setPastedAttachments([]);
    await sendMessage(content);
  }, [draft, pastedAttachments, isLoading, sendMessage, t]);

  // Same thresholds as the standalone chat: big pastes become chips,
  // small pastes fall through to the default behavior untouched.
  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>): void => {
      const pasted = event.clipboardData?.getData("text");
      if (!pasted || !shouldWrapAsAttachment(pasted)) return;
      event.preventDefault();
      setPastedAttachments((prev) => [...prev, createPastedAttachment(pasted)]);
    },
    [],
  );

  const canSend = draft.trim().length > 0 || pastedAttachments.length > 0;

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  // If the panel closes, return focus to the toolbar toggle in the parent
  // (the parent decides; this panel only releases focus state).
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  // Always mounted: the parent wrapper reclaims the layout width via
  // `w-0 overflow-hidden` when closed, so this section renders through
  // the collapse animation. `inert` keeps the hidden panel out of the
  // tab order and the accessibility tree while it is clipped.
  return (
    <section
      role="complementary"
      aria-label={t("assistant.aria")}
      data-masarx-assistant-panel=""
      inert={!open}
      className="flex h-full w-full min-w-0 flex-col border-s border-border bg-background"
    >
      <header
        className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4"
        // Chrome — selection suppressed (FR-013)
        style={{ userSelect: "none" }}
      >
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("assistant.heading")}
          </p>
          <p
            className="truncate text-sm font-medium text-foreground"
            title={
              scope.lectureTitle
                ? `${scope.subjectName} · ${scope.lectureTitle}`
                : scope.subjectName
            }
          >
            {scope.lectureTitle
              ? t("assistant.scope", {
                  lecture: scope.lectureTitle,
                  subject: scope.subjectName,
                })
              : t("assistant.scopeEmpty", { subject: scope.subjectName })}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t("assistant.closeAria")}
          className="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("assistant.close")}
        </button>
      </header>

      <div
        ref={transcriptRef}
        // Transcript opts BACK into selection per FR-014 — study content
        // must remain copyable. The CSS class below is the documented
        // opt-in point referenced by T020 (desktop-shell.css).
        className="selectable-content min-h-0 flex-1 overflow-y-auto px-4 py-3"
        style={{ scrollbarGutter: "stable" }}
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            {t("assistant.emptyTranscript")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`flex flex-col gap-1 rounded-lg p-3 text-sm ${
                  message.type === "user"
                    ? "ms-auto max-w-[85%] bg-primary text-primary-foreground"
                    : "me-auto max-w-[85%] bg-muted text-foreground"
                }`}
              >
                <span className="text-[11px] uppercase tracking-wide opacity-80">
                  {message.type === "user" ? t("assistant.role.you") : t("assistant.role.zane")}
                </span>
                <span className="whitespace-pre-wrap leading-relaxed">{message.content}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 flex-col gap-2 border-t border-border bg-background/95 p-3 backdrop-blur"
      >
        {pastedAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pastedAttachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-muted py-1.5 pe-1.5 ps-2.5 text-xs font-medium text-foreground"
              >
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block max-w-[160px] truncate font-bold">
                    {t("assistant.pastedText")}
                  </span>
                  <span className="block text-[10px] opacity-70">
                    {att.sizeLabel} • {att.charCount} {t("assistant.pastedChars")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPastedAttachments((prev) => prev.filter((a) => a.id !== att.id))
                  }
                  aria-label={t("assistant.removeAttachment")}
                  className="shrink-0 rounded-md p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            // Enter sends, Shift+Enter inserts newline.
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitDraft();
              }
            }}
            onPaste={handlePaste}
            rows={2}
            placeholder={t("assistant.composerPlaceholder")}
            aria-label={t("assistant.composerAria")}
            className="selectable-content min-h-[2.5rem] flex-1 resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={!canSend || isLoading}
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isLoading ? t("assistant.sending") : t("assistant.send")}
          </button>
        </div>
      </form>
    </section>
  );
}
