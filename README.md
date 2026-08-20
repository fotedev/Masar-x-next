# Masar X

Modern learning platform for university students — study summaries, interactive courses, quizzes, AI-powered assistance, and comprehensive learning management tools. The web app ships today; the desktop (Electron) and mobile (Expo) apps are landing in [Spec 004 — Multi-Platform Expansion](./specs/004-multi-platform-expansion/spec.md).

## Repository layout

This is a **pnpm monorepo**. Apps and shared code live in sibling directories under the repo root, and pnpm workspaces link them via the workspace protocol. The structure is set by [Spec 004 Phase 1](./specs/004-multi-platform-expansion/plan.md#project-structure) and stabilized by [Phase 2](./specs/004-multi-platform-expansion/plan.md#cross-cutting-concerns).

```
masarx_next/
├── apps/
│   ├── web/         Next.js 16 web app (the live product surface today)
│   ├── desktop/     Electron + electron-builder + electron-updater   (US1, ships Phase 3)
│   └── mobile/      Expo SDK 51, React Native 0.74.5                  (US2, ships Phase 4)
├── packages/
│   └── shared/      Cross-platform code: i18n messages, Supabase
│                    client factory, database types + Zod schemas,
│                    AI client. Consumed by all three apps via the
│                    workspace protocol. See the contracts in
│                    specs/004-multi-platform-expansion/contracts/
├── supabase/        Supabase migrations, Edge Functions, seed data
├── specs/           Design specs (SpecKit) — one folder per spec
│   └── 004-multi-platform-expansion/
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md            Phase-2 deliverables (T009–T016) live here
│       ├── contracts/          Internal cross-platform contracts
│       │   ├── README.md
│       │   ├── supabase-client.md
│       │   ├── i18n-messages.md
│       │   └── ai-boundary.md
│       ├── data-model.md
│       ├── research.md
│       └── quickstart.md
├── .github/
│   ├── workflows/ci.yml        3 jobs + 2 new required checks (T014, T015)
│   └── scripts/                CI helper scripts (T014)
├── pnpm-workspace.yaml
├── package.json                Root scripts: dev, build, lint, typecheck, test
└── README.md                   This file
```

## Apps

| App        | Stack                                              | Status            | Spec |
|------------|----------------------------------------------------|-------------------|------|
| `web`      | Next.js 16, React 19, TypeScript, next-intl, Tailwind, Framer Motion | Live (production) | — |
| `desktop`  | Electron, electron-builder, electron-updater, better-sqlite3 | Phase 3 (US1)     | [Spec 004 §Phase 3](./specs/004-multi-platform-expansion/spec.md) |
| `mobile`   | Expo SDK 51, React Native 0.74.5, expo-secure-store, expo-document-picker | Phase 4 (US2)     | [Spec 004 §Phase 4](./specs/004-multi-platform-expansion/spec.md) |

The web app is the source of truth for product behavior; the desktop and mobile apps are feature-parity ports that share the same Supabase backend and the same `packages/shared/` code.

## Cross-platform contracts

The three apps agree to four cross-platform contracts when sharing code through `packages/shared/`. Each is documented as a standalone file in [`specs/004-multi-platform-expansion/contracts/`](./specs/004-multi-platform-expansion/contracts/). They are **not** API contracts for the product's public surface (those live in the Supabase schema and the Edge Functions). They are **internal contracts between the apps and the shared package** — each is a security boundary as well as a code-sharing convenience.

- **[`supabase-client.md`](./specs/004-multi-platform-expansion/contracts/supabase-client.md)** — How each runtime gets a Supabase client, what each client is allowed to do, and the hard guarantee that the service-role key never reaches a client context.
- **[`i18n-messages.md`](./specs/004-multi-platform-expansion/contracts/i18n-messages.md)** — How translation messages are shared, and the contract for adding or renaming a key.
- **[`ai-boundary.md`](./specs/004-multi-platform-expansion/contracts/ai-boundary.md)** — How the AI provider key stays server-side, and what each client is and is not allowed to do.
- **[`README.md`](./specs/004-multi-platform-expansion/contracts/README.md)** — Why these are contracts, not just helpers, and the process for changing one.

The contracts are enforced by four CI / build-time checks (added in Phase 2):

| Task | Check                                                              | Severity | Where |
|------|--------------------------------------------------------------------|----------|-------|
| T008 | gitleaks on the source tree (working tree + push hook)              | required | `.gitleaks.toml` |
| T013 | ESLint `no-restricted-imports` blocking `openai` and `@anthropic-ai/sdk` outside the Edge Function and shared package | error    | `apps/web/eslint.config.mjs` |
| T014 | grep for AI provider endpoint strings outside the Edge Function and `packages/shared/ai/__fixtures__/**` | required | `.github/scripts/check-ai-provider-endpoints.sh` |
| T015 | gitleaks on built artifacts (the post-`next build` tree)           | required | `.github/workflows/ci.yml` (`gitleaks-artifacts` job) |

A change to any contract is a **breaking change** to all three apps. See [`specs/004-multi-platform-expansion/contracts/README.md`](./specs/004-multi-platform-expansion/contracts/README.md#reviewing-changes-to-a-contract) for the review checklist.

## Getting started

### Prerequisites

- **Node.js 24+** (the CI runs on Node 24; older versions may work for the web app but are not tested).
- **pnpm 11+** (this repo uses `allowBuilds` per pnpm v11, which removed the legacy `onlyBuiltDependencies` setting).
- **Supabase project** (the web app's database + auth + storage + Edge Functions).
- A local `.env.local` per app — see the app's own README for the env var list.

### Install

```bash
pnpm install
```

The workspace protocol links `apps/{web,desktop,mobile}` to `packages/shared` and to each other; you do not need a separate `npm install` per workspace.

### Run the web app

```bash
pnpm dev               # alias for `pnpm dev:web`
# or, explicitly:
pnpm dev:web
```

The app is available at `http://localhost:3000`.

### Run the desktop app (when the source lands in Phase 3)

```bash
pnpm dev:desktop
```

The Electron main process spawns a local Next.js server on a random free port and opens a `BrowserWindow` pointing at it. In production, the same Next.js server is bundled into the asar and started at launch.

### Run the mobile app (when the source lands in Phase 4)

```bash
pnpm dev:mobile        # Expo dev server
pnpm --filter mobile ios      # iOS Simulator
pnpm --filter mobile android  # Android Emulator
```

### Build all three

```bash
pnpm build             # alias for `pnpm build:web`
pnpm build:web
pnpm build:desktop     # (Phase 3)
pnpm build:mobile      # (Phase 4)
```

In v1 (Phase 2), only `pnpm build:web` produces a deployable artifact. The desktop and mobile builds land in their respective user-story phases.

### Lint, typecheck, test

```bash
pnpm lint              # `pnpm --filter web lint` in v1
pnpm typecheck         # `pnpm -r --if-present typecheck` (cross-workspace)
pnpm test              # `pnpm -r --if-present test`
```

`pnpm lint` is configured with `--max-warnings=500` for the web app's pre-existing warning surface; the security-guard rules in `apps/web/eslint.config.mjs` are at `error` severity, so a violation fails the build.

## Adding a new shared package

The repo is set up for adding more shared packages under `packages/`. To add one (e.g. `packages/analytics/`):

1. Create the directory with a `package.json` whose `name` is the unscoped name (e.g. `masarx-analytics`), `type: "module"`, and `main`/`types`/`exports` pointing at `./src/index.ts`.
2. Add a `tsconfig.json` that extends a base if one is added later; for now, the one in `packages/shared/tsconfig.json` is a good template.
3. The workspace is auto-discovered via `pnpm-workspace.yaml`'s `packages: ["apps/*", "packages/*"]`. No change needed.
4. From an app, depend on it via `"masarx-analytics": "workspace:*"` in the app's `package.json`. Add a `paths` entry in the app's `tsconfig.json` if you need to import the source directly (see `apps/web/tsconfig.json` for the existing `masarx-shared/*` mapping).
5. Wire any cross-platform enforcement into the contracts in `specs/004-multi-platform-expansion/contracts/` BEFORE the package gains consumers. The contracts are the place to document the security boundary, not the README.

## Adding a new user story

1. Add a new spec under `specs/NNN-short-name/`. The SpecKit template (see the SPECKIT START block in this repo's `.harness/config.yaml`) provides the sections.
2. Identify any new cross-platform code that should live in `packages/shared/`. Add the contract to `specs/NNN-short-name/contracts/` BEFORE the code lands, mirroring the four existing contracts in Spec 004.
3. Implement the user story in the relevant app(s) (web, desktop, mobile). Use the shared package; do not reach for `@supabase/supabase-js`, `openai`, or `@anthropic-ai/sdk` directly (the ESLint rule from T013 will block it).
4. Update this README's "Apps" table with the new feature.

## Security posture

The web app's security posture is unchanged by the monorepo migration. The Supabase project keeps its RLS policies, the service-role key stays in Vercel env, and the AI provider key stays in the Edge Function's environment. The contracts in `specs/004-multi-platform-expansion/contracts/` are the additional surface to review when changing cross-platform code.

The four CI / build-time checks (T008, T013, T014, T015) are the **mechanical** enforcement of those contracts. Code review is the human layer. The two are not interchangeable: a security guard that a developer can disable in a PR is observability, not enforcement.

## Spec & plan

The active design work lives in [`specs/004-multi-platform-expansion/`](./specs/004-multi-platform-expansion/):

- [`spec.md`](./specs/004-multi-platform-expansion/spec.md) — 6 user stories, 23 functional requirements, 12 success criteria, 12 assumptions, 5 out-of-scope items, 9 edge cases.
- [`plan.md`](./specs/004-multi-platform-expansion/plan.md) — Cross-cutting concerns (AI boundary enforcement, web non-regression, server-side-only enforcement), implementation strategy, rollback notes.
- [`tasks.md`](./specs/004-multi-platform-expansion/tasks.md) — 66 tasks across 9 phases. Phase 1 (Setup) and Phase 2 (Foundational) are complete on the `004-multi-platform-expansion` branch.
- [`contracts/`](./specs/004-multi-platform-expansion/contracts/) — The four cross-platform contracts.
- [`quickstart.md`](./specs/004-multi-platform-expansion/quickstart.md) — Developer walkthrough for the full monorepo.

## License & ownership

Internal project. Source-available to the team; see the `LICENSE` file (or your repo settings) for the exact terms.
