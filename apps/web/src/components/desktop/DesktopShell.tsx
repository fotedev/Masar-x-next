"use client";

/**
 * DesktopShell — runtime-gated native-feel shell for spec 005 US2/US3/US4.
 *
 * Renders ONLY inside the Electron shell. The hook is hydration-safe
 * (false on the server + first client paint, then flips post-mount), so
 * the SSR HTML is byte-for-byte identical to the browser's first paint
 * and React does not log a hydration mismatch. Inside the shell this
 * composes three fixed regions:
 *
 *   1. CustomTitlebar       — 32px frameless strip with drag region + window controls
 *   2. DesktopSidebar       — 240px ↔ 56px RTL-aware rail with primary nav
 *   3. <main>                — inner content with overflow-y-auto (the ONLY pane that scrolls)
 *
 * The shell owns the FR-017 invariant: the BrowserWindow viewport never
 * scrolls. `h-screen overflow-hidden` is on the outer wrapper, and the only
 * descendant with `overflow-y-auto` is the inner <main>. Sidebar chrome
 * and the titlebar are fixed, and the inner pane scrolls independently.
 *
 * Children MUST be ready for a flex container with `min-h-0` and a single
 * scroll axis. The previous Layout.tsx already returned a `flex h-full
 * min-h-0 flex-1` chain, so this is a drop-in replacement for the desktop
 * branch.
 */

import { type ReactNode } from "react";
import { useIsDesktopRuntime } from "@/lib/desktop/useIsDesktopRuntime";
import { CustomTitlebar } from "./CustomTitlebar";
import { DesktopSidebar } from "./DesktopSidebar";

interface DesktopShellProps {
  children: ReactNode;
}

export function DesktopShell({ children }: DesktopShellProps): React.JSX.Element | null {
  const isDesktop = useIsDesktopRuntime();

  if (!isDesktop) {
    return null;
  }

  return (
    <div
      dir="rtl"
      className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground"
    >
      <CustomTitlebar />

      {/* Layout direction:
            Under `dir="rtl"` (Arabic): the first flex child lands on the
            INLINE-START edge — the RIGHT side of the window.
            Under `dir="ltr"` (English): the same first child lands on the
            LEFT side. This matches Notion / Slack / VS Code: the sidebar
            sits on the "reading-start" edge of the document, regardless
            of language.

            Do NOT add `flex-row-reverse`. Reversing the direction would
            put the sidebar on the opposite edge — sidebar on the LEFT
            for Arabic — which is wrong for an RTL reader's mental model. */}
      <div className="flex min-h-0 flex-1 flex-row">
        <DesktopSidebar />

        <main
          role="main"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default DesktopShell;