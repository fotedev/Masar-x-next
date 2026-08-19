# Implementation Plan: 004 — Multi-Platform Expansion (Desktop + Mobile)

**Branch**: `004-multi-platform-expansion` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-multi-platform-expansion/spec.md`

## Summary

Expand Masar X from a single Next.js web app to three surfaces — web (unchanged), desktop (Electron wrapper around the existing Next.js build), and mobile (Expo / React Native for iOS and Android). The web app remains the canonical surface. Desktop and mobile are consumers of the same Supabase backend and the same shared domain code (translations, types, Supabase client factory). The repository is reorganized into a pnpm-workspaces monorepo with a single shared package.

The technical decisions are recorded in [research.md](./research.md); the data model is in [data-model.md](./data-model.md); the cross-platform interface contracts are in [contracts/](./contracts/); the developer setup walkthrough is in [quickstart.md](./quickstart.md).

## Cross-cutting concerns (non-negotiable across all phases)

These are requirements that apply to every user story and every release, not features of any single story. They are recorded here so the implementation phase treats them as release-blockers, not as polish:

- **Mechanical enforcement of the AI provider key boundary.** The contract in [contracts/ai-boundary.md](./contracts/ai-boundary.md) forbids any direct call to an AI provider's API from any client context. A documentation rule is not enough. CI MUST include a check that fails the build if a known AI provider API host string (`api.openai.com`, `api.anthropic.com`, and equivalents for any other provider the Edge Function may route to) appears in any file outside `supabase/functions/**` and `packages/shared/ai/__fixtures__/**` (test fixtures are exempt by path). Additionally, an ESLint `no-restricted-imports` rule MUST block direct imports of the AI provider SDKs (`openai`, `@anthropic-ai/sdk`, and equivalents) from any path outside `supabase/functions/**` and `packages/shared/**`. The lint rule and the CI grep together close the raw-HTTP bypass; `gitleaks` on the built artifacts (existing) closes the leaked-key symptom. This is a required deliverable, not an implementation detail to be picked up if a future contributor notices.

- **Web app non-regression.** Every change to the monorepo, the shared package, the contracts, and the build pipeline is expected to leave the web app's behavior, URLs, and public API unchanged. A passing web-app smoke test (existing Playwright suite, preserved) is the gate for any PR that touches the monorepo's structure.

- **Server-side enforcement belongs at the server.** As noted in [contracts/README.md](./contracts/README.md), Row Level Security (FR-018) and rate limits (FR-019) are enforced at the Supabase project/policy layer, not in the client code. The implementation phase MUST NOT duplicate these in the apps; doing so creates a second source of truth that can drift.

## Technical Context

**Language/Version**: TypeScript 5.x across all apps. Next.js 16 + React 19 for the web (existing). Electron 30+ for the desktop runtime. Expo SDK 51+ / React Native 0.74+ for mobile.

**Primary Dependencies**:
- **Web** (existing): Next.js 16, React 19, Supabase JS, next-intl, Drizzle ORM, Tailwind, framer-motion.
- **Desktop (new)**: Electron, electron-builder, electron-updater, the same Supabase JS / next-intl / Tailwind as the web, run inside a local Next.js server.
- **Mobile (new)**: Expo, React Native, expo-localization, react-native-async-storage, expo-secure-store, expo-document-picker, the same Supabase JS client.
- **Shared (new)**: pnpm workspaces, plain TypeScript, Zod for runtime validation, the Supabase JS client re-exported through a factory.

**Storage**:
- Supabase Postgres (existing) — single source of truth for user data, study content, AI conversation history.
- Supabase Storage (existing) — study-summary PDFs and other user uploads.
- Electron local SQLite (new, optional) — for the desktop app's offline read cache; not authoritative, just a local cache synced from Supabase.
- AsyncStorage / SecureStore on mobile (new) — auth tokens, user preferences, recent AI conversation cache.

**Testing**:
- **Web** (existing): Vitest + Playwright. The existing test suite is preserved; tests for the shared package run from the web app's CI.
- **Desktop (new)**: Smoke test of the local server, plus the same Vitest tests for shared code that runs in the desktop app.
- **Mobile (new)**: Jest (via Expo's preset) for unit tests, Maestro or Detox for E2E (E2E is a v1.1 add — see `quickstart.md` for what ships in v1).
- **Cross-cutting**: gitleaks in CI scans every built artifact (see research.md §8).

**Target Platform**:
- **Web**: Vercel (existing).
- **Desktop**: Windows 10+, macOS 11+, current major Linux distros (Ubuntu LTS baseline). Distributable as `.exe` / `.dmg` / `.AppImage` and `.deb` / `.rpm`.
- **Mobile**: iOS 14+, Android 8.0 (API level 26+). Distributable via App Store and Play Store; signed builds for direct install are out of scope for v1.

**Project Type**: Monorepo with three apps and one shared package — see [Project Structure](#project-structure) below.

**Performance Goals**: Anchored to the spec's success criteria:
- Desktop cold-launch under 3 s on a standard development machine (SC-009).
- Mobile list scroll smooth (no visible jank) on a mid-range Android device (SC-007).
- Mobile data usage lower than the equivalent mobile-browser session (SC-008).
- Clean-clone build end-to-end under 30 min on a documented CI runner (SC-012).

**Constraints**:
- Server-only secrets (Supabase service role, AI provider keys) MUST NOT appear in any client-distributed bundle, on any platform (FR-017, FR-020).
- All cross-platform code reuse MUST go through the shared package — no copy-paste between apps (FR-021, FR-022).
- The web app's behavior, URLs, and public API MUST NOT regress as a side effect of the monorepo move (Assumption A8).

**Scale/Scope**:
- Three apps (web, desktop, mobile) and one shared package.
- v1 mobile feature surface = the main web journeys (sign in, browse subjects, read summary, send AI message, upload PDF, switch language). Other features (admin pages, internal dashboards) are out of scope for v1 mobile per Assumption in spec.
- Existing Supabase schema is unchanged; no platform-specific migrations (Assumption A5).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project's `.specify/memory/constitution.md` is currently a placeholder template — no project-specific principles or governance constraints are recorded. The Constitution Check therefore has no enforceable gates at this time.

**Recommended additions for the team to ratify before the implementation phase begins** (not in scope for this plan to author — they belong in a separate `speckit.constitution` pass):

1. **Single source of truth for cross-platform state**: any logic that more than one app needs MUST live in `packages/shared/`. Lint rule to be added.
2. **Server-only secrets never ship to clients**: enforced by gitleaks on built artifacts in CI; release blocked on any match.
3. **Web app is canonical**: visual and behavioral changes are authored on the web first, then propagated to desktop and mobile. Desktop and mobile PRs that diverge from the web without justification are rejected.
4. **Monorepo is the only structure**: no splitting the monorepo back into separate repos without a recorded ADR.

These are recorded here as candidates, not as Constitution text.

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-platform-expansion/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── README.md
│   ├── supabase-client.md
│   ├── i18n-messages.md
│   └── ai-boundary.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (already authored)
└── spec.md              # The spec (already authored)
```

### Source Code (repository root, target end-state)

```text
masarx_next/
├── apps/
│   ├── web/                  # Existing Next.js app, moved from src/ root
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── next.config.ts
│   ├── desktop/              # New: Electron app
│   │   ├── src/
│   │   │   ├── main/         # Electron main process
│   │   │   ├── preload/      # Electron preload scripts
│   │   │   └── renderer/     # Optional — the web build is served by main
│   │   ├── electron-builder.yml
│   │   └── package.json
│   └── mobile/               # New: Expo app
│       ├── app/              # Expo Router
│       ├── src/
│       ├── app.json
│       ├── eas.json
│       └── package.json
├── packages/
│   └── shared/               # New: cross-platform code
│       ├── src/
│       │   ├── messages/     # i18n JSON files (Arabic + English)
│       │   ├── types/        # Database types, API contracts
│       │   ├── supabase/     # Client factory
│       │   └── i18n/         # Per-runtime i18n helpers
│       ├── package.json
│       └── tsconfig.json
├── scripts/                  # Existing repo scripts, kept as-is
├── supabase/                 # Existing Supabase config, unchanged
├── package.json              # Root package.json (pnpm workspace)
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

**Structure Decision**: Monorepo with `apps/{web,desktop,mobile}` and `packages/shared`. The existing `src/` directory at the repo root is moved to `apps/web/src/` as part of the migration. The shared package is consumed via the `workspace:*` protocol. This layout is the smallest structure that satisfies FR-016 and FR-021–023 without adding unnecessary packages (no separate `ui`, `config`, or `eslint-config` packages for v1).

### Migration path (ordered to keep the web app working at every step)

1. Initialize pnpm workspaces at the repo root. Existing `src/` stays where it is; nothing breaks yet.
2. Add `packages/shared/` with an empty `src/index.ts`. Wire it as a workspace dep in the existing root `package.json`. Nothing breaks.
3. Move `src/messages/` to `packages/shared/src/messages/`. Update imports in the web app to point at the shared package. **Web app behavior unchanged.**
4. Move the existing Supabase client factory to `packages/shared/src/supabase/`. Update imports. **Web app behavior unchanged.**
5. Move TypeScript types for the database to `packages/shared/src/types/`. Update imports. **Web app behavior unchanged.**
6. Move the existing `src/` directory to `apps/web/src/`. Update tooling configs (`next.config.ts`, `tsconfig.json`, `vitest.config.ts`, etc.) to the new path. **Web app behavior unchanged.**
7. Add `apps/desktop/` (Electron) and `apps/mobile/` (Expo) per their respective quickstart sections.
8. Wire CI to build all three apps and run the secret scan on each artifact.

Steps 1–6 are sequential and each one is independently deployable. The web app is the source of truth at every step, so a rollback to the previous state is just `git revert` of the relevant step.

**Rollback note (added during review, 2026-08-19):** In the actual implementation, steps 1 and 6 landed in a single atomic commit that moved the entire web app from `src/` to `apps/web/src/` along with all of its supporting configs. This means the practical rollback unit for "go back to a single-package layout" is that one commit (`git revert <sha>`), not two separate reverts. The other steps (2-5: shared-package extraction, 7: desktop/mobile scaffolds, 8: CI matrix) are still independent and revertible individually.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Monorepo with three apps + one shared package | Spec FR-016 mandates monorepo with shared translations and types; FR-021–023 require independent build of all three | A single Next.js app with the desktop and mobile shells compiled in is structurally not possible — Electron and Expo have non-overlapping build pipelines, and the monorepo is the only way to share the Supabase client and i18n without copy-paste. |
| pnpm workspaces (not npm workspaces) | Strict peer-dependency resolution and content-addressable storage matter when Electron is one of the consumers — phantom dependencies (an Electron app pulling in Next.js-only code) are a real risk | npm workspaces work but do not prevent phantom dependencies; Turborepo / Nx add tooling surface area without benefit at this size |
| Electron (not Tauri) for the desktop wrapper | The team's existing expertise is in JS/TS, not Rust; the spec lists desktop + mobile parity, not minimum binary size | Tauri produces a smaller binary and uses less RAM, but the team would need to learn Rust for any non-trivial native integration; the spec accepts 15–25% higher RAM as the cost of using the team's existing skill set |
| Expo (managed workflow, not bare React Native) | The team has no existing iOS/Android tooling; Expo provides working builds out of the box, and EAS handles the platform-specific build orchestration | Bare React Native requires maintaining native iOS/Android projects from day one; not justified for v1 |
| Edge Function as the AI boundary, not per-platform | One place to audit the AI key path; one place to rotate the key; one place to apply rate limits | Per-platform key management leaks the key into each app's bundle and makes rotation a multi-platform chore |

No other complexity violations. The structure is the minimum that delivers the spec.
