"use client";

import { useTranslations } from "next-intl";
import { Wrench, Zap } from "lucide-react";
import { ZaneAvatar, type ZaneStatus } from "./ZaneAvatar";

/**
 * The single ZANE status avatar (spec 048) — the only avatar surface in the
 * chat. One DOM node, two responsive presentations:
 *
 * - `<lg` (Muse-mobile style): floats top-center OVER the message list,
 *   with a dark pill overlapping the avatar's bottom edge showing the name
 *   and status. `pointer-events-none` so messages underneath stay
 *   interactive; the scroll content clears it via its own top padding.
 * - `lg+` (issue #240 interim): a plain 96px docked circle — the name and
 *   status text are hidden there (the status is already visible in the
 *   clip itself) and survive as a native `title` tooltip. The final
 *   design — avatar into the side-menu header — lands with #239.
 */
export function ZaneStatusAvatar({ status }: { status: ZaneStatus }) {
  const t = useTranslations("aiAssistant");

  const statusLabel =
    status === "working" ? t("statusWorking") : t("statusConnected");

  return (
    <div
      className="pointer-events-none flex flex-col items-center max-lg:absolute max-lg:top-3 max-lg:left-1/2 max-lg:z-20 max-lg:-translate-x-1/2 lg:pointer-events-auto"
      title={`${t("assistantName")} — ${statusLabel}`}
    >
      <ZaneAvatar status={status} className="h-28 w-28 shrink-0 lg:h-24 lg:w-24" />
      {/* max-lg only since #240: the docked lg+ presentation is a bare
          circle — the text pill exists solely for the floating overlay. */}
      <div className="-mt-3 flex flex-col items-center max-lg:rounded-2xl max-lg:bg-slate-900/90 max-lg:px-3.5 max-lg:py-1.5 max-lg:backdrop-blur lg:hidden">
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
