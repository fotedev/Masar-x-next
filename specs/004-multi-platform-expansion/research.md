# Research: Multi-Platform Expansion (Spec 004)

**Date**: 2026-08-17
**Status**: Decisions recorded
**Spec**: [spec.md](./spec.md)

This document captures the technical decisions for expanding Masar X to desktop and mobile, the alternatives considered for each, and the rationale for choosing one over the others. Every decision here is consistent with the WHAT-not-HOW framing of the spec — tools and approaches are chosen because they fit the requirements, not the other way around.

## Research questions

1. Which monorepo tool for the shared package layout?
2. Which desktop wrapper around the existing Next.js build?
3. Which mobile framework for the iOS / Android apps?
4. How to share i18n messages across web, desktop, and mobile?
5. How to share the Supabase client and types across all three?
6. How to ship auto-updates to the desktop app and recover from failed updates?
7. How to sign desktop installers and pass OS security gates?
8. Which automated secret-scanning tool to run on built artifacts?
9. How to wire AI provider keys server-side only?
10. How to ship to App Store / Play Store without leaking secrets at submission time?

## Decision log

### 1. Monorepo tool: **pnpm workspaces**

- **Decision**: Use pnpm workspaces (not Turborepo, not Nx).
- **Rationale**: pnpm workspaces is a workspace coordinator, not a build orchestrator. The build orchestration for this project is per-app (Next.js build, Electron Builder, EAS Build) and doesn't benefit from a top-level build cache at this size. pnpm gives us the workspace protocol (`workspace:*`) for the shared package without adding a second tool's surface area. The team already uses npm; pnpm is a drop-in that adds content-addressable storage and strict peer-dependency resolution.
- **Alternatives considered**:
  - **Turborepo**: Good for larger monorepos with many packages and shared build caches. Overkill here — three apps, one shared package, no need for remote caching yet. Easy to add later.
  - **Nx**: Same story as Turborepo, plus a heavier CLI footprint. Not needed.
  - **npm workspaces**: Works, but lacks pnpm's hoisting controls, which matter for avoiding phantom dependencies (an Electron app pulling in Next.js-only code is a real risk).
- **Spec alignment**: Spec Assumption A1 says "monorepo with shared package(s)"; spec does not pin a tool. This is a planning decision per the Assumption.

### 2. Desktop wrapper: **Electron** (with local Next.js server)

- **Decision**: Electron main process that loads the existing Next.js build over a local HTTP server (not `file://`).
- **Rationale**: Two viable approaches — load the static export over `file://`, or run a small local HTTP server. The local HTTP server is preferred because (a) the web app uses absolute paths and service workers that don't work well with `file://`, (b) it preserves the existing Next.js routing behavior unchanged, and (c) it allows the desktop app to use the same Supabase SSR flow that the web uses, with cookies handled naturally. Electron is the chosen runtime because it's the de facto standard and the team has Node.js expertise.
- **Alternatives considered**:
  - **Tauri**: Smaller binary, Rust-based, no Chromium. Pros: smaller, faster, less RAM. Cons: Rust learning curve, less mature webview interop, doesn't help with this team's existing JS/TS skill set. Could be revisited later if RAM becomes a real problem (the spec mentions 15-25% more RAM usage is acceptable).
  - **WebView2-only / WKWebView-only**: More work, less ecosystem, no real benefit at this stage.
- **Spec alignment**: Spec FR-003 says "reuse the existing Next.js web build as its primary surface"; the local-server approach does this most faithfully.

### 3. Mobile framework: **Expo (managed workflow)**

- **Decision**: Expo SDK with the managed workflow, not bare React Native.
- **Rationale**: The team is starting from zero on mobile — no existing iOS/Android tooling, no native modules already wired. Expo's managed workflow gives us a working iOS/Android build without standing up Xcode/Android Studio locally for every developer, and EAS Build handles the platform-specific build orchestration. The features the spec needs (offline read, share sheet, push notification readiness, secure storage, file picker) are all in Expo's standard library.
- **Alternatives considered**:
  - **Bare React Native**: More control, but requires maintaining native iOS/Android projects. Not justified for v1.
  - **Native (Swift/Kotlin)**: Out of scope; would defeat the "reuse backend and shared types" goal.
- **Spec alignment**: Spec does not pin a tool here. The spec mentions "React Native" implicitly via the source, but Expo is the production-ready way to ship React Native apps today.
- **Note on EAS**: EAS Build is used because it's the build orchestrator Expo provides. The build pipeline is real (FR-M06), not the marketing version. The signing/notarization requirements (FR-001) flow through EAS for the mobile side.

### 4. i18n sharing: **Shared JSON files + per-runtime loader**

- **Decision**: Keep the existing `src/messages/*.json` files, move them to `packages/shared/messages/`, and have each runtime load them through a small adapter (next-intl on web, expo-localization on mobile, direct import on desktop).
- **Rationale**: Translations are flat JSON with no React-specific structure, so they can be consumed by any runtime. The shared package exports the JSON files plus a TypeScript type that describes the shape. Each app's i18n library handles the language switching, but the source of strings is the same on disk.
- **Alternatives considered**:
  - **i18next on all three platforms**: Possible, but next-intl is already in the web app; switching introduces churn with no gain.
  - **FormatJS / react-intl**: Same as i18next, more setup, no benefit.
  - **Translation management platform (Crowdin, Lokalise)**: Out of scope for v1; the source file workflow is fine.
- **Spec alignment**: Spec FR-013 and FR-021 require single source of truth and "one edit, one build per platform". This approach delivers both.

### 5. Supabase client sharing: **Factory in shared package, env-var per runtime**

- **Decision**: `packages/shared/supabase/` exports a factory function `createSupabaseClient(runtime: 'web' | 'desktop' | 'mobile')`. Each runtime injects the right env-var source (Next.js `process.env` for web/desktop, `expo-constants` for mobile).
- **Rationale**: The Supabase JS client is the same library; only the env-var source differs. A factory keeps the type surface clean and forces every callsite to declare its runtime, which makes the "no service role key on the client" invariant easy to enforce with a lint rule later.
- **Alternatives considered**:
  - **Three separate clients**: Duplication, drift risk.
  - **Single client with env-var polyfill**: Hides the runtime difference; bad for auditability.
- **Spec alignment**: Spec FR-014 (auth continuity) and FR-015 (single Supabase project) both require the same client surface across platforms. The factory delivers this without leaking runtime-specific code.

### 6. Auto-update: **electron-updater with a documented release channel**

- **Decision**: Use `electron-updater` (built on `autoUpdater` from Electron) with a documented stable channel, plus a manual fallback path for users on the previous version.
- **Rationale**: electron-updater is the standard solution in the Electron ecosystem. It supports signed updates, differential downloads, and the canonical "fail-apply-on-startup → revert" pattern that FR-005 requires. The "automatic rollback on failed apply" behavior is built into the library when updates are applied on next launch (the previous version's asar is still on disk and is loaded if the new one fails integrity checks).
- **Alternatives considered**:
  - **Custom update mechanism**: Rejected — reinventing the wheel, and signing is non-trivial.
  - **No auto-update (manual download)**: Rejected — Spec FR-005 requires it.
- **Spec alignment**: FR-005 (auto-update with automatic rollback) is delivered by electron-updater + the existing asar-on-disk pattern.

### 7. Installer signing: **electron-builder defaults + EV cert**

- **Decision**: Use electron-builder for installer generation with platform-correct signing:
  - **macOS**: Developer ID Application + notarization via `notarytool`.
  - **Windows**: Authenticode signing (EV code-signing certificate preferred to avoid SmartScreen reputation build-up).
  - **Linux**: GPG signature on the AppImage / .deb / .rpm; no separate "security gate" beyond distro warnings.
- **Rationale**: electron-builder is the most-used Electron packaging tool and handles all three platforms. The signing outcome ("installer does not trigger OS security warnings") is the spec requirement; the specific cert type and tooling is the implementation choice.
- **Alternatives considered**:
  - **electron-forge**: Slightly nicer dev experience, weaker signing story for production releases.
  - **Manual packaging**: Rejected — error-prone and unsupported.
- **Spec alignment**: FR-001 (installer doesn't trigger OS security warnings) is delivered by signed + notarized + Authenticode'd installers.

### 8. Secret scanning: **gitleaks in CI + pre-commit**

- **Decision**: Run `gitleaks detect --no-git --source <artifact-dir>` against every built artifact (Electron asar, Expo bundle, Next.js static export) as part of the release pipeline, plus `gitleaks protect --pre-commit` for local dev.
- **Rationale**: gitleaks has the broadest pattern library for known secret formats (Supabase, OpenAI, Anthropic, GitHub, AWS, etc.) and can scan non-git directories. Running on the **built artifact**, not just the source, is critical: a secret that never appears in source can be introduced by a build-time string concatenation.
- **Alternatives considered**:
  - **trufflehog**: Better at finding real (verifiable) secrets, worse at false-positive suppression in CI. Better for periodic deep scans, not as the release gate.
  - **Custom regex script**: Non-starter, will miss things.
  - **Source-only scanning**: Insufficient — misses build-time leaks.
- **Spec alignment**: FR-017 (automated, run before each release) and SC-005 (zero matches on built artifacts) are delivered by gitleaks on the artifact.

### 9. AI provider key isolation: **Next.js API route + Supabase Edge Function**

- **Decision**: Every AI request from any client (web, desktop, mobile) goes through a server-side boundary that injects the AI provider key. The desktop and mobile apps do **not** call the AI provider directly. Two implementation options for the boundary:
  - **Next.js API route** (`/api/ai/*`): already deployed for the web, also serves the Electron build's local Next.js server.
  - **Supabase Edge Function** (`ai/*`): shared by web, desktop, and mobile; no per-platform code.
- **Rationale**: The Edge Function path is the cleanest because it's the only server-side code that the mobile app talks to. The web can also use it. The Electron build's local server can proxy to the Edge Function or talk to it directly.
- **Alternatives considered**:
  - **Per-platform key management**: Each app stores its own AI key, rotated manually. Rejected — leaks the key into each app's bundle.
  - **Direct calls from web, edge function for mobile**: Inconsistent and harder to audit.
- **Spec alignment**: FR-020 (AI provider credentials never reachable from client code) is delivered by routing all AI requests through the server-side boundary.

### 10. App Store / Play Store submission: **EAS Submit for mobile, electron-builder publish for desktop**

- **Decision**:
  - **iOS / Android**: EAS Build + EAS Submit. Credentials stored in EAS, never in the repo.
  - **Desktop**: electron-builder publish to GitHub Releases (signed installers uploaded as release assets), with optional auto-update pointing at the GitHub release feed.
- **Rationale**: EAS handles the App Store / Play Store credential dance correctly (no private keys in the repo). GitHub Releases gives the desktop app a free, signed, versioned distribution channel that electron-updater can read from directly.
- **Alternatives considered**:
  - **Direct `xcrun altool` / `fastlane`**: Rejected — EAS wraps these with better error messages and a credential store.
  - **Self-hosted artifact server**: Rejected — extra infrastructure for no benefit at this size.
- **Spec alignment**: SC-011 (apps reach their intended distribution channel) is delivered by EAS Submit for mobile and electron-builder publish to GitHub Releases for desktop.

## What this research did **not** decide (and why)

- **Specific monorepo tool migration order**: not decided here; that's a plan concern. The shared package layout (apps/{web,desktop,mobile}, packages/shared/{messages,supabase,types}) is decided.
- **Specific build agent for CI**: not decided here. GitHub Actions is the obvious default for a Next.js project already on GitHub, but not pinned. Decision belongs to the plan, not the research.
- **Specific translation file format changes**: not needed. The existing JSON shape is fine.
- **SRS / Apple Sign-In / masarx:// / tablet layouts / parallel backends**: explicitly **not** decided. These are out of scope per the spec. The plan will not scaffold hooks for any of them.

## Open questions for the user (none blocking, all informational)

These are not `NEEDS CLARIFICATION` markers — they are decisions that the plan can default and the user can override later.

1. **CI provider**: GitHub Actions vs Vercel CI vs something else. Default: GitHub Actions (matches the existing repo, free for public, cheap for private).
2. **Internal vs public shared package**: Default: internal (no npm publish). If the team plans to open-source parts later, this needs a re-do.
3. **Build cache for CI**: Default: no remote cache. Re-evaluate if CI runtime becomes a problem.

These are recorded so the plan is transparent about its assumptions, but they are not blocking the next phase.
