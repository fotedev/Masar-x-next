"use client";

/**
 * UpdateToast — surfaces electron-updater events inside the desktop shell.
 *
 * The preload bridge (apps/desktop/src/main/preload.ts) exposes
 * `masarxDesktop.updates`, and the main process broadcasts
 * `updates:available` / `updates:error`. Until this component existed
 * nothing in the renderer consumed them, so updates were silent background
 * downloads with a surprise restart-on-quit (audit 2026-09-08 R9).
 *
 * Renders only inside the Electron shell; every bridge access is
 * null-checked so an old/missing preload degrades to a no-op.
 * The preload does not forward `updates:error` yet, so this toast
 * surfaces availability only — update failures stay in the main-process
 * log until the preload grows an `onError` passthrough.
 * Strings come from the `desktopUpdates` namespace
 * (packages/shared/src/messages/{ar,en}/desktopUpdates.json).
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useIsDesktopRuntime } from "@/lib/desktop/useIsDesktopRuntime";
import { getDesktopBridge } from "@/lib/desktop/runtime";

export function UpdateToast(): React.JSX.Element | null {
  const t = useTranslations("desktopUpdates");
  const isDesktop = useIsDesktopRuntime();
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isDesktop) return undefined;
    const updates = getDesktopBridge()?.updates ?? null;
    if (!updates) return undefined;

    return updates.onAvailable((info) => {
      setAvailableVersion(info.version);
    });
  }, [isDesktop]);

  if (!isDesktop) return null;

  const handleInstall = (): void => {
    if (!availableVersion || installing) return;
    setInstalling(true);
    getDesktopBridge()
      ?.updates?.installAndRestart()
      .catch(() => setInstalling(false));
  };

  const handleLater = (): void => {
    if (!availableVersion) return;
    getDesktopBridge()
      ?.updates?.skip(availableVersion)
      .catch(() => {});
    setAvailableVersion(null);
  };

  if (!availableVersion) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 end-4 z-[10000] flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-lg"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <p className="text-xs text-muted-foreground">
          {t("description", { version: availableVersion })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("install")}
        </button>
        <button
          type="button"
          onClick={handleLater}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("later")}
        </button>
      </div>
    </div>
  );
}

export default UpdateToast;
