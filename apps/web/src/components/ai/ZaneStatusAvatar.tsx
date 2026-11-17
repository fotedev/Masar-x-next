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
 * - `lg+` (Muse-desktop style): docked as the chat's head block — avatar on
 *   top, name and status line beneath it, over the page background.
 */
export function ZaneStatusAvatar({ status }: { status: ZaneStatus }) {
  const t = useTranslations("aiAssistant");

  return (
    <div className="pointer-events-none flex flex-col items-center max-lg:absolute max-lg:top-3 max-lg:left-1/2 max-lg:z-20 max-lg:-translate-x-1/2 lg:pointer-events-auto">
      <ZaneAvatar status={status} className="h-28 w-28 shrink-0 lg:h-32 lg:w-32" />
      <div className="-mt-3 flex flex-col items-center max-lg:rounded-2xl max-lg:bg-slate-900/90 max-lg:px-3.5 max-lg:py-1.5 max-lg:backdrop-blur lg:mt-2 lg:gap-0.5">
        <span
          className="text-sm font-bold leading-tight text-white lg:text-base lg:font-extrabold lg:text-slate-900 lg:dark:text-white"
          dir="auto"
        >
          {t("assistantName")}
        </span>
        <span
          className={`flex items-center gap-1 text-xs leading-tight lg:text-sm ${
            status === "working"
              ? "text-slate-300 lg:text-slate-500 lg:dark:text-slate-400"
              : "text-green-400 lg:text-green-600 lg:dark:text-green-400"
          }`}
          dir="auto"
        >
          {status === "working" ? (
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Zap className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          )}
          {status === "working" ? t("statusWorking") : t("statusConnected")}
        </span>
      </div>
    </div>
  );
}
