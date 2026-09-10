"use client";

/**
 * DesktopSidebar — RTL-aware persistent navigation rail for the desktop shell
 * (spec 005, US4 / FR-021..FR-024).
 *
 * Visual contract:
 *   - Collapsed: 56px wide, icons only, label hidden.
 *   - Expanded: 240px wide, icons + Arabic labels from the `nav` i18n namespace.
 *   - The collapsed state persists across sessions via localStorage under
 *     `masarx.sidebar.collapsed`. SSR + first client paint always render the
 *     EXPANDED state so the SSR HTML matches the browser first paint
 *     (FR-011); the persisted state is applied in an effect and may briefly
 *     flip the sidebar one frame later — invisible because the Electron
 *     window only shows once the page is fully loaded.
 *   - Toggle control lives in the footer cluster (collapse/expand chevron).
 *   - Active route is highlighted per-route (Home → brand-blue, Courses →
 *     green, Quizzes → purple, AI Assistant → indigo, etc.) to preserve the
 *     existing web Header visual language — see apps/web/src/components/Header.tsx
 *     §Home / News / Subjects / Courses / Quizzes / ai-assistant link array.
 *
 * Layout integration:
 *   - Parent DesktopShell uses `flex-row-reverse`, which flips the sidebar
 *     to the inline-start edge for RTL locales and the inline-end edge for
 *     LTR locales — this gives us a Notion / Linear / VS Code-style rail
 *     that sits on the RIGHT for Arabic (matches Masar X's RTL orientation)
 *     and the LEFT for English, without any per-locale conditional class.
 *   - All internal spacing uses logical properties (`border-inline-start`,
 *     `ps-`, `pe-`, `gap-`) so the same JSX works under both `dir="rtl"`
 *     and `dir="ltr"`.
 *
 * Gating:
 *   - Component returns `null` until `useIsDesktopRuntime` flips true. In a
 *     browser tab this never happens, so the sidebar contributes zero bytes
 *     to the web path beyond the module's own JS (which is dead code).
 *   - The web Header keeps owning the mobile + desktop-web navigation
 *     surfaces; the desktop sidebar is additive.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations as useNextIntlTranslations } from "next-intl";

import { useIsDesktopRuntime } from "@/lib/desktop/useIsDesktopRuntime";

interface NavEntry {
  /** Route key, used as the tNav() lookup key. */
  key: "home" | "news" | "subjects" | "courses" | "quizzes" | "assistant" | "profile" | "downloads";
  /** Route URL — relative, locale-prefix is added at render time. */
  href: string;
  /** Pathname prefix used to mark the entry active. */
  matchPrefix: string;
  /** Tailwind classes for the icon background + active text colour. */
  activeText: string;
  activeBg: string;
  /** Inline SVG icon node, 20x20, stroke="currentColor". */
  icon: React.JSX.Element;
}

const NAV_ENTRIES: ReadonlyArray<NavEntry> = [
  {
    key: "home",
    href: "/",
    matchPrefix: "/",
    activeText: "text-brand-blue",
    activeBg: "bg-brand-blue/10",
    icon: <HomeIcon />,
  },
  {
    key: "news",
    href: "/news",
    matchPrefix: "/news",
    activeText: "text-brand-orange",
    activeBg: "bg-brand-orange/10",
    icon: <NewsIcon />,
  },
  {
    key: "subjects",
    href: "/subjects",
    matchPrefix: "/subjects",
    activeText: "text-brand-blue",
    activeBg: "bg-brand-blue/10",
    icon: <BookIcon />,
  },
  {
    key: "courses",
    href: "/courses",
    matchPrefix: "/courses",
    activeText: "text-green-600 dark:text-green-400",
    activeBg: "bg-green-600/10",
    icon: <CoursesIcon />,
  },
  {
    key: "quizzes",
    href: "/quizzes",
    matchPrefix: "/quizzes",
    activeText: "text-purple-600 dark:text-purple-400",
    activeBg: "bg-purple-600/10",
    icon: <QuizzesIcon />,
  },
  {
    key: "assistant",
    href: "/ai-assistant",
    matchPrefix: "/ai-assistant",
    activeText: "text-indigo-600 dark:text-indigo-300",
    activeBg: "bg-indigo-500/10",
    icon: <SparklesIcon />,
  },
  {
    key: "profile",
    href: "/profile",
    matchPrefix: "/profile",
    activeText: "text-emerald-600 dark:text-emerald-300",
    activeBg: "bg-emerald-500/10",
    icon: <ProfileIcon />,
  },
  {
    key: "downloads",
    href: "/downloads",
    matchPrefix: "/downloads",
    activeText: "text-slate-700 dark:text-slate-200",
    activeBg: "bg-slate-500/10",
    icon: <DownloadIcon />,
  },
];

const STORAGE_KEY = "masarx.sidebar.collapsed";
const EXPANDED_WIDTH = "w-60"; // 240px
const COLLAPSED_WIDTH = "w-14"; // 56px

export function DesktopSidebar(): React.JSX.Element | null {
  const isDesktop = useIsDesktopRuntime();
  const tNav = useNextIntlTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname() ?? "";

  // SSR + first client paint: always expanded. The persisted state is
  // applied in the effect below; the brief mismatch is invisible because
  // the Electron window only renders after the page has loaded.
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // localStorage blocked — keep expanded default.
    }
    setHydrated(true);
  }, [isDesktop]);

  const toggle = useCallback((): void => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore: storage write failures don't affect UI state.
      }
      return next;
    });
  }, []);

  if (!isDesktop) return null;

  // Strip the leading locale prefix from the pathname so the matchPrefix
  // comparison is locale-agnostic.
  const strippedPath = pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";

  return (
    <aside
      role="navigation"
      aria-label="Primary navigation"
      className={
        "flex h-full flex-shrink-0 flex-col border-border bg-card transition-[width] duration-200 ease-out " +
        "border-e " +
        (collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH)
      }
    >
      {/* Spacer under the titlebar — keeps the brand mark aligned with the
          titlebar's centerline instead of fighting its 32px height. */}
      <div className="h-2" aria-hidden />

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-1">
          {NAV_ENTRIES.map((entry) => {
            const isActive =
              entry.matchPrefix === "/"
                ? strippedPath === "/"
                : strippedPath === entry.matchPrefix ||
                  strippedPath.startsWith(`${entry.matchPrefix}/`);
            const label = tNav(entry.key);
            const href = `/${locale}${entry.href === "/" ? "" : entry.href}`;

            return (
              <li key={entry.key}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={
                    "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium " +
                    "transition-colors " +
                    (isActive
                      ? `${entry.activeBg} ${entry.activeText}`
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")
                  }
                >
                  <span
                    className={
                      "flex h-5 w-5 shrink-0 items-center justify-center " +
                      (isActive ? "" : "text-muted-foreground group-hover:text-foreground")
                    }
                  >
                    {entry.icon}
                  </span>
                  <span
                    className={
                      "truncate " + (collapsed ? "sr-only" : "")
                    }
                  >
                    {label}
                  </span>
                  {isActive && !collapsed ? (
                    <span
                      aria-hidden
                      className={
                        "ms-auto h-1.5 w-1.5 rounded-full " +
                        entry.activeText.replace("text-", "bg-")
                      }
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer cluster: collapse toggle + version stamp. Both are always
          visible; the toggle remains clickable in both states. */}
      <div className="border-border border-t px-2 py-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={
            "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-xs font-medium " +
            "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          }
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {collapsed ? <ChevronEndIcon /> : <ChevronStartIcon />}
          </span>
          <span className={collapsed ? "sr-only" : ""}>
            {collapsed ? "Expand" : "Collapse"}
          </span>
        </button>
        <div
          className={
            "mt-1 truncate px-3 text-[10px] font-mono text-muted-foreground/70 " +
            (collapsed ? "sr-only" : "")
          }
        >
          Masar X · v{hydrated ? "0.5.9" : "0.5.9"}
        </div>
      </div>
    </aside>
  );
}

/* ---------- Inline icons (20x20, currentColor) ----------
   Inlined to match CustomTitlebar's pattern — no extra network round-trip,
   no icon-font dependency. Strokes use currentColor so the per-route active
   colour set on the <Link> drives the icon tint without a re-render. */

function HomeIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9.5 10 3l7 6.5" />
      <path d="M5 9v7a1 1 0 0 0 1 1h3v-5h2v5h3a1 1 0 0 0 1-1V9" />
    </svg>
  );
}

function NewsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
      <path d="M15 6h1.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-3 0" />
      <path d="M7 8h5M7 11h5M7 14h3" />
    </svg>
  );
}

function BookIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 4v12" />
      <path d="M4 5v11a1 1 0 0 0 1 1h5V4H5a1 1 0 0 0-1 1Z" />
      <path d="M16 5v11a1 1 0 0 1-1 1h-5V4h5a1 1 0 0 1 1 1Z" />
    </svg>
  );
}

function CoursesIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7l7-3 7 3-7 3-7-3Z" />
      <path d="M6 9v4c0 1 2 2 4 2s4-1 4-2V9" />
    </svg>
  );
}

function QuizzesIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <path d="M8 8.5a2 2 0 1 1 2.7 1.85c-.5.25-.7.55-.7 1.15" />
      <circle cx="10" cy="13.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function SparklesIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 3v3M10 14v3M3 10h3M14 10h3" />
      <path d="m6 6 2 2M12 12l2 2M6 14l2-2M12 8l2-2" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  );
}

function ProfileIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10" cy="7" r="3" />
      <path d="M3.5 16.5c.7-3 3.3-4.5 6.5-4.5s5.8 1.5 6.5 4.5" />
    </svg>
  );
}

function DownloadIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 3v9" />
      <path d="m6 8 4 4 4-4" />
      <path d="M4 15v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1" />
    </svg>
  );
}

/** Chevron pointing to the inline-start edge: under `dir="rtl"` (Arabic)
 *  this points right, so clicking it collapses the sidebar inward. Under
 *  `dir="ltr"` it points left, mirroring the same intent in English. */
function ChevronStartIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m10 3-5 5 5 5" />
    </svg>
  );
}

/** Chevron pointing to the inline-end edge — opposite of the above, used
 *  when the sidebar is collapsed and clicking expands it back out. */
function ChevronEndIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

export default DesktopSidebar;