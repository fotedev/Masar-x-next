# 19 — Mobile (Expo/RN) Startup & Screen Performance

> Method note: this domain was analyzed by the audit coordinator (not a subagent) after the subagent quota was exhausted mid-run. Same evidence standard: every claim verified against the file cited. Static analysis only — no device run; all runtime numbers remain [TBD] per `docs/perf/baselines.md`.

## Findings

### [MOBILE-1] MathText renders every math block in its own WebView, fetching KaTeX from jsdelivr CDN at runtime

- **Priority P2 · Impact M (grows with content)** — QuizPlay, QuizAttempts, SummaryDetail and AIAssistant all render math via `MathText`, which builds an HTML string embedding `<link>` + `<script defer>` from `cdn.jsdelivr.net` (`apps/mobile/src/components/MathText.tsx:22,85-86`). Each instance is a full WebView: cold render latency, per-instance memory, CDN round-trips, and **broken math offline** (the "previously loaded content remains readable" contract of FR-011 doesn't hold for equations).
- **Current**: N WebViews + N CDN fetches per screen with math. · **Fix**: bundle KaTeX assets locally (expo-asset / react-native-webview `source={require(...)}`) and/or share one WebView; long-term, a native/text-based math renderer. · **Effort M**

### [MOBILE-2] No splash-screen hold — native splash dismisses, then an in-app spinner runs while auth resolves

- **Priority P2 · Impact M** — `index.js` mounts immediately; `AuthContext` bootstraps via `getSession()` (SecureStore-backed, fast but async), and until then `RootNavigator` renders an `ActivityIndicator` placeholder (`apps/mobile/app/App.tsx:181-187`). Users see native splash → blank/white frame → spinner → content: a double-flash on every cold start. `expo-splash-screen` is not used anywhere (grep: no hits).
- **Fix**: `SplashScreen.preventAutoHideAsync()` in index.js, hide after `status !== "loading"`. One-screen startup code. · **Effort S**

### [MOBILE-3] AuthContext re-runs state setters on every auth event, including TOKEN_REFRESHED

- **Priority P2 · Impact L** — `onAuthStateChange` handler calls `setSession`/`setStatus` unconditionally for every event (`apps/mobile/src/context/AuthContext.tsx:99-102`), and every `TOKEN_REFRESHED` also rewrites the SecureStore mirror (`:106-107`). Consumer count is small (5 screens + App shell) so the re-render churn is bounded — but the same identity-churn pattern the web AuthContext has (RENDER-1) exists here in miniature.
- **Fix**: skip `setSession` when user id unchanged on TOKEN_REFRESHED; keep mirror writes (they're async and idempotent). · **Effort S**

### [MOBILE-4] All 11 screens statically imported; no `enableFreeze` on navigation

- **Priority P2 · Impact L** — Every screen is a top-level import in `apps/mobile/app/App.tsx:51-61`, so the Hermes bundle parses all 11 screens (2,000+ lines of screen code) before first paint. The native-stack only mounts screens on navigation (so runtime mount cost is fine), but parse cost is paid upfront, and the bottom-tab navigator keeps all 5 tab screens live once visited — `enableFreeze`/`enableFreeScreens` are nowhere in the codebase (grep: no hits).
- **Fix**: `enableFreeze(true)` on NavigationContainer (one line, react-native-screens already a dep); screen-level `React.lazy` is not practical under Metro — parse cost is better attacked by trimming the shared bundle (see 20-mobile-data). · **Effort S**

### [MOBILE-5] Every runtime metric in the mobile budgets table is unmeasured

- **Priority P1 · Impact M (process risk)** — specs/004 budgets (mid-range Android scroll jank, data ≤50% of browser session) are 100% [TBD] in `docs/perf/baselines.md`, and CI runs `expo export` only as a graph-resolution "bundle proof" with no size assertion (`.github/workflows/ci.yml:402-403`). There is no device measurement loop at all.
- **Fix**: same instrumentation approach as desktop: log `performance.now()` markers at bootstrap milestones (JS init → auth resolved → first screen mounted), run on one pinned mid-range Android device, record in baselines.md §3; add an `expo export` bundle-size echo step to CI (non-blocking) so growth is visible. · **Effort S**

## Healthy areas

- **AuthProvider is the model implementation** the web one should copy: memoized context value with `useCallback` handlers (`apps/mobile/src/context/AuthContext.tsx:148-160`), session restore from local storage (`:81-95`, no network roundtrip), one subscription with proper cleanup (`:113-116`).
- **Provider stack is minimal**: SafeAreaProvider > ThemeProvider > AuthProvider > I18nProvider > SentryBoundary (`App.tsx:240-252`) — no query-provider layer at boot (the lean `useSupabaseQuery` decision).
- **Sentry init is lean and honest**: DSN-gated, no tracing configured → near-zero startup overhead (`apps/mobile/src/lib/sentry.ts:39-42`); `SentryBoundary` only wraps the shell.
- **Lists use FlatList with keyExtractor** on all four list screens (NewsScreen.tsx:146, QuizAttemptsScreen.tsx:329, QuizzesScreen.tsx:81, AIAssistantScreen.tsx:302) — no `.map()` inside ScrollView for list data. QuizPlay's ScrollView is question-by-question (bounded).
- **`expo-dev-client` is a devDependency pattern** — release builds don't ship the dev menu (verified in package.json scripts; EAS release profile uses `expo export` graph).
- **RTL direction is set once per session by design** (`App.tsx:174-179`) — no per-frame I18nManager work.
