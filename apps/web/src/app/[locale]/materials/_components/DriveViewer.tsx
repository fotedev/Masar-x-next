"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Loader2 } from "lucide-react";
import { driveOpenUrl, drivePreviewUrl } from "@/lib/materials";

export function DriveViewer({ fileId, name }: { fileId: string; name: string }) {
  const t = useTranslations("materials");
  const [loaded, setLoaded] = useState(false);

  // Reset the loading state whenever the selected file changes.
  useEffect(() => setLoaded(false), [fileId]);

  return (
    <div className="w-full" data-testid="materials-drive-viewer">
      <div className="mb-2 flex items-center justify-between gap-x-2">
        <p className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-300">
          {name}
        </p>
        <a
          href={driveOpenUrl(fileId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-x-1.5 text-sm text-brand-blue hover:underline"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          {t("openInDrive")}
        </a>
      </div>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
        style={{ aspectRatio: "16 / 9" }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            <span className="sr-only">{t("loadingViewer")}</span>
          </div>
        )}
        <iframe
          src={drivePreviewUrl(fileId)}
          title={name}
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 h-full w-full"
          allow="autoplay"
          data-testid="materials-drive-iframe"
          aria-label={t("viewerAria")}
        />
      </div>
    </div>
  );
}
