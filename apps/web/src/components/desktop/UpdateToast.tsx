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
 * Strings come from the `desktopUpdates` namespace
 * (packages/shared/src/messages/{ar,en}/desktopUpdates.json).
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useIsDesktopRuntime } from "@/lib/desktop/useIsDesktopRuntime";

interface DesktopUpdatesBridge {
  onAvailable(
    cb: (info: { version: string; releaseDate?: string }) => void,
  ): () => void;
  onError(cb: (err: { message: string }) => void): () => void;
  installAndRestart(): Promise<void>;
  skip(version: string): Promise<void>;
}

function getUpdatesBridge(): DesktopUpdatesBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (
    window as unknown as { masarxDesktop?: { updates?: DesktopUpdatesBridge } }
  ).masarxDesktop;
  return bridge?.updates ?? null;
}

export function UpdateToast(): React.JSX.Element | null {
  const t = useTranslations("desktopUpdates");
  const isDesktop = useIsDesktopRuntime();
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [errorVisible, setErrorVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isDesktop) return undefined;
    const updates = getUpdatesBridge();
    if (!updates) return undefined;

    const offAvailable = updates.onAvailable((info) => {
      setAvailableVersion(info.version);
      setErrorVisible(false);
    });
    const offError = updates.onError(() => {
      setErrorVisible(true);
    });
    return () => {
      offAvailable();
      offError();
    };
  }, [isDesktop]);

  if (!isDesktop) return null;

  const handleInstall = (): void => {
    if (!availableVersion || installing) return;
    setInstalling(true);
    const updates = getUpdatesBridge();
    updates?.installAndRestart().catch(() => setInstalling(false));
  };

  const handleLater = (): void => {
    if (!availableVersion) return;
    const updates = getUpdatesBridge();
    updates?.skip(availableVersion).catch(() => {});
    setAvailableVersion(null);
  };

  if (errorVisible) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 end-4 z-[10000] flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-lg"
      >
        <p className="text-sm text-foreground">{t("errorTitle")}</p>
        <button
          type="button"
          onClick={() => setErrorVisible(false)}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("dismiss")}
        </button>
      </div>
    );
  }

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
