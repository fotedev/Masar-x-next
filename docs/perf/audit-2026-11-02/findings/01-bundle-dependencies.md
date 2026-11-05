# 01 — Web Bundle & Dependency Weight

> Subagent auditor #1, 2026-11-02. Domain: apps/web bundle & dependency weight. Spot-check note: Puter lazy-import (`lib/puter.ts:137`), quizzes-page dynamic modals, and react-hot-toast absence re-verified by cross-corroborating auditors in the same run.

## Findings

### BUNDLE-1 Admin dashboard statically imports 11 tab/modal components — one giant admin chunk

- Priority: P1 · Impact: High — admin-dashboard is the top candidate for the measured 392.5 KB chunk; every admin boot parses all tabs and modals when only one renders.
- Evidence: `apps/web/src/app/[locale]/admin-dashboard/page.tsx:11-24` — `import { NewsTab } from "@/components/NewsTab";` … `AddNewsModal`, `PageManagementTab`, `AddCourseModal`, `SubjectsTab`, `AddSubjectModal`, `ManageLecturesModal`, `AdminAnalyticsPage` (line 15), plus `AdminOverviewTab` via admin-shell. Only the active tab is rendered.
- Current: all 11 modules + their hooks/forms land in the page chunk at first paint. · Fix: convert tabs/modals to `next/dynamic` keyed on `activeTab` / open-state (the page already uses `dynamic` for modals elsewhere; no new pattern needed). · Effort: M

### BUNDLE-2 framer-motion loads on every route via Header → MobileNav

- Priority: P1 · Impact: High — contributes to the shared/Header chunk parsed on all pages (bootup 2.89s on /ar/quizzes); MobileNav is a drawer shown only on menu tap.
- Evidence: `apps/web/src/components/header/MobileNav.tsx:3` — `import { motion, AnimatePresence } from "framer-motion";` statically imported at `apps/web/src/components/Header.tsx:18` (`import { MobileNav } from "./header/MobileNav";`). Layout already dynamic-loads Header (`src/components/Layout.tsx:18-22`) but Header mounts immediately on every page.
- Current: framer-motion in the always-loaded Header chunk. · Fix: `dynamic(() => import("./MobileNav"))` inside Header, rendered when the menu first opens; or replace drawer motion with CSS transitions. · Effort: S–M

### BUNDLE-3 dotlottie-react is eagerly imported on the AI assistant page (1390 KB total, bootup 2.28s)

- Priority: P1 · Impact: High — /ar/ai-assistant measured heaviest page; dotlottie JS ships in the page chunk before any animation is needed.
- Evidence: `apps/web/src/components/ai/LottiePlayer.tsx:11-12` — `import dynamic from "next/dynamic";` … `import { setWasmUrl } from "@lottiefiles/dotlottie-react";` (static value import, not type). LottiePlayer is statically imported by `src/components/ai/ChatContainer.tsx:12` and `ChatMessageItem.tsx:12`, both eager from `src/app/[locale]/ai-assistant/page.tsx:12-13`.
- Current: dotlottie-react + framer-motion (`ChatContainer.tsx:11`) parse before first chat message. · Fix: make `LottiePlayer` a `dynamic()` component at its two call sites (render a static poster/placeholder), keeping `setWasmUrl` inside that chunk so it runs before first mount. · Effort: M

### BUNDLE-4 `uuid` is an unused runtime dependency

- Priority: P2 · Impact: Low — dead dep adds install weight and risks accidental client inclusion; zero imports found.
- Evidence: `apps/web/package.json:61` — `"uuid": "^14.0.3",`; `rg "from .uuid" src` in apps/web returns nothing.
- Current: installed, never imported. · Fix: `pnpm remove uuid` (also move `@types/katex` from dependencies to devDependencies, package.json:39). · Effort: S

### BUNDLE-5 Leftover Vite devDependencies (recurring — narrowed)

- Priority: P2 · Impact: Low — devDeps don't reach the client bundle, but the older audit's claim is still partially true: 2 of the 5 are unused leftovers.
- Evidence: `apps/web/package.json:92-93` — `"vite-plugin-compression": "^0.5.1"`, `"vite-plugin-pwa": "^1.2.0"` — no reference anywhere in configs/scripts; PWA is Next-native now. (`vite` :91 and `@vitejs/plugin-react` :76 are still required by vitest — do not remove.)
- Current: two dead Vite plugins. · Fix: `pnpm remove -D vite-plugin-compression vite-plugin-pwa`. · Effort: S

### BUNDLE-6 date-fns v4 kept for a single `format()` call

- Priority: P2 · Impact: Low — one route, one function; ESM tree-shaking keeps it small but the dep is replaceable for free.
- Evidence: `apps/web/src/app/[locale]/trw/my-access/page.tsx:14` — `import { format } from "date-fns";` — the only date-fns import in src.
- Current: full date-fns dependency for one call. · Fix: swap to `Intl.DateTimeFormat` (locale already available) and drop `date-fns` from package.json:42. · Effort: S

### BUNDLE-7 HomeClient eagerly imports EditSummaryModal and three framer-motion sections

- Priority: P2 · Impact: Medium — home is the landing route (`src/app/[locale]/page.tsx:1`, `force-dynamic`); the edit modal is opened only from section cards but parses upfront.
- Evidence: `apps/web/src/components/HomeClient.tsx:4-8` — `SummariesSection`, `VideosSection`, `QuizzesSection` (all in the framer-motion file list), `import { EditSummaryModal } from "@/components/EditSummaryModal";`
- Current: modal + 3 animated sections in the home chunk. · Fix: `dynamic()` for `EditSummaryModal` on open; sections can stay eager (above-fold cards) or lazy-load on scroll. · Effort: S

## Healthy areas

- **Puter SDK lazy-loading verified still true (recurring claim)**: `apps/web/src/lib/puter.ts:137` — `const m = await import('@heyputer/puter.js');` inside `loadRealPuterClient`; page-side `PuterSettingsModal` also dynamic (`src/app/[locale]/ai-assistant/page.tsx:29`).
- **Markdown/KaTeX pipeline fully code-split**: `src/components/ai/LazyMarkdown.tsx:10-13` dynamic-imports `MarkdownRendererHeavy` (react-markdown + remark-gfm + remark-breaks + rehype-highlight) with `ssr:false`; `LazyMarkdown.tsx:4` uses inline `type Components` so react-markdown is erased from the light chunk. `src/components/LatexRenderer.tsx:29` dynamic-imports `HeavyLatexRenderer`; `katex.min.css` (`HeavyLatexRenderer.tsx:5`) and `highlight.js/styles/github-dark.css` (`MarkdownRendererHeavy.tsx:4`) ride in the heavy chunks only. `PreloadKatex` pre-warms quiz routes — good.
- **PageTransition already dynamic**: `src/components/Layout.tsx:24-26` (`{ ssr: false }`), despite being framer-motion (`PageTransition.tsx:4`).
- **lucide-react import style is clean**: 130 files, all named imports, 0 star imports (verified across src) — fully tree-shakeable under Next's built-in optimizePackageImports.
- **react-hot-toast claim is stale**: not in `package.json` at all and zero imports; `sonner` 2.0.7 is the toast lib (package.json:59, AppProviders.tsx:10). Old audit row should be closed.
- **Server-only heavy deps stay server-side**: `@modelcontextprotocol/sdk` only in `src/app/api/mcp/route.ts:1-2`; `ai` only in `src/app/api/ai/chat/route.ts:2`; drizzle-orm/pg confined to `src/lib/admin-db/schema.ts` + server files, `serverExternalPackages: ["pg"]` (next.config.mjs:11); `ProfileRow` is `export type` (schema.ts:26) so client contexts don't drag drizzle in.
- **Quizzes page is framer-free and modals already dynamic**: `src/app/[locale]/quizzes/page.tsx:26,36,46` dynamic-import QuizImportModal/QuizFormModal/QuizDeleteDialog; `QuizDashboardFilters.tsx`/`QuizGridItem.tsx` have no heavy imports. Its 2.08s TBT is mostly the shared chunk, not page-local weight.
- **`@swc/helpers` explicit dep is intentional**: documented workaround in `next.config.mjs` (outputFileTracingIncludes for Electron standalone) — not a leftover.
- **Shared layout chunk composition is legitimate**: supabase-js (AuthContext.tsx:9, Header.tsx:8, one shared client module), TanStack Query, sonner Toaster, next-intl — all required at first auth-capable paint; no fat additions found in AppProviders/Layout/Footer/NotificationManager chains.

## Notes

Measured figures taken as given (no build re-run per rules). The three P1s map to the measured hotspots: BUNDLE-1 → largest chunk, BUNDLE-2 → per-route boot (TBT 2.08s on /ar/quizzes), BUNDLE-3 → /ar/ai-assistant 1390KB. A Turbopack bundle-analyzer run (`pnpm analyze` with `--webpack`, already scripted) would confirm chunk attribution before/after. Older audit's react-hot-toast row is closed; its Vite-devDeps row survives in reduced form (BUNDLE-5).
