"use client";

import { useTranslations } from "next-intl";
import { Wrench, Zap } from "lucide-react";
import { ZaneAvatar, type ZaneStatus } from "./ZaneAvatar";

/**
 * The floating ZANE status avatar (spec 048) — the only avatar surface in
 * the chat COLUMN, and only on narrow viewports: it floats top-center OVER
 * the message list with a dark pill overlapping the avatar's bottom edge
 * showing the name and status. `pointer-events-none` so messages underneath
 * stay interactive; the scroll content clears it via its own top padding.
 * Spec 051: the docked lg+ presentation (interim plain circle since #240)
 * is gone — the avatar's permanent home is the side-menu header
 * (ConversationPanel), so the component hides entirely at lg+ and the
 * floating classes are unconditional. The empty-state hero (ChatContainer)
 * remains the avatar's home for the initial state.
 */
export function ZaneStatusAvatar({ status }: { status: ZaneStatus }) {
  const t = useTranslations("aiAssistant");

  const statusLabel =
    status === "working" ? t("statusWorking") : t("statusConnected");

  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center lg:hidden">
      <ZaneAvatar status={status} className="h-28 w-28 shrink-0" />
      <div className="-mt-3 flex flex-col items-center rounded-2xl bg-slate-900/90 px-3.5 py-1.5 backdrop-blur">
        <span className="text-sm font-bold leading-tight text-white" dir="auto">
          {t("assistantName")}
        </span>
        <span
          className={`flex items-center gap-1 text-xs leading-tight ${
            status === "working" ? "text-slate-300" : "text-green-400"
          }`}
          dir="auto"
        >
          {status === "working" ? (
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Zap className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          )}
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
