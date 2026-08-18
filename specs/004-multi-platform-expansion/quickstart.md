# Quickstart: 004 — Multi-Platform Expansion

**Date**: 2026-08-17
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

A developer walkthrough for the monorepo layout, from a clean clone to a working build of all three apps. Targets a contributor joining the project after the monorepo migration is complete. For the migration plan (how to get from the current state to this state, in order, without breaking the web app), see [plan.md §Migration path](./plan.md#migration-path-ordered-to-keep-the-web-app-working-at-every-step).

## Prerequisites

A clean development machine (Windows 10+, macOS 11+, or Ubuntu LTS) with:

- **Node.js 20+** (matches the web app's current requirement; the desktop and mobile apps reuse the same Node toolchain).
- **pnpm 9+** (`npm install -g pnpm`).
- **Git 2.30+**.
- For the desktop build: **Platform-correct signing tooling** (macOS: `xcrun notarytool` and a Developer ID cert; Windows: an Authenticode cert; Linux: GPG for `.deb`/`.rpm`/`.AppImage` signatures).
- For the mobile build: **EAS Build** credentials (Apple Developer account for iOS, Google Play Console account for Android) — provisioned outside this feature per Assumption A9.
- **Supabase project access** (the existing project, with anon key + service role key in the developer's `.env.local`).

The web app's existing `.env.example` is the starting point; the new monorepo root `.env.example` includes additional keys documented inline.

## Repository layout (target end-state)

```text
masarx_next/
├── apps/
│   ├── web/         # Next.js 16 + React 19 (existing, moved from src/ root)
│   ├── desktop/     # Electron app (new)
│   └── mobile/      # Expo / React Native app (new)
├── packages/
│   └── shared/      # Cross-platform code: messages, types, supabase client
├── scripts/         # Existing repo scripts
├── supabase/        # Existing Supabase config (unchanged)
├── package.json     # Root pnpm workspace
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

The `src/` directory that currently lives at the repo root is moved to `apps/web/src/` during the migration. The migration is ordered to keep the web app working at every step (see plan.md §Migration path).

## First-time setup

```bash
# 1. Clone (or update existing clone)
git clone <repo-url> masarx_next
cd masarx_next

# 2. Install all workspace dependencies in one pass
pnpm install

# 3. Copy the .env.example files
cp apps/web/.env.example apps/web/.env.local
# (Add SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#  AI provider key, etc. — same set as the existing web app.)

# 4. (Optional) Verify the toolchain
pnpm typecheck
```

After `pnpm install`, the `packages/shared` workspace is symlinked into each app's `node_modules` automatically. No build step is required for the shared package — its TypeScript is consumed by each app's existing TS pipeline.

## Running each app

### Web (existing — unchanged)

```bash
pnpm dev:web
# Opens http://localhost:3000
```

The web app's `package.json` gets a `dev` script that runs `next dev`. The behavior is identical to the pre-monorepo version; the only change is the directory.

### Desktop (new)

```bash
pnpm dev:desktop
# Launches Electron with the Next.js dev server attached
```

The desktop app in dev mode uses the Next.js dev server (HMR works) plus an Electron window pointing at `http://localhost:3000`. In production, the Electron main process starts a small local Node server that serves the built Next.js output, then opens a window pointing at it.

### Mobile (new)

```bash
pnpm dev:mobile
# Starts the Expo dev server; scan the QR with Expo Go on a real device
# or run on the iOS Simulator / Android Emulator from the dev server UI
```

The mobile app in dev mode uses Expo Go (or the iOS Simulator / Android Emulator if you have Xcode / Android Studio installed). The shared package is bundled into the Metro bundler via pnpm's workspace support.

## Building each app

### Web

```bash
pnpm build:web
# Outputs to apps/web/.next
# Deploy via Vercel as before; no change to the deployment pipeline.
```

### Desktop

```bash
pnpm build:desktop
# Outputs to apps/desktop/dist/
#  - Windows: masarx-x-setup-<version>.exe (signed with Authenticode)
#  - macOS:   masarx-x-<version>.dmg  (signed + notarized)
#  - Linux:   masarx-x-<version>.AppImage, .deb, .rpm (GPG-signed)
```

The first build of any platform requires the signing cert in the local keychain / config. See `apps/desktop/electron-builder.yml` for the cert paths.

### Mobile

```bash
# Local build (no EAS, requires Xcode / Android Studio locally)
pnpm build:mobile:ios
pnpm build:mobile:android

# EAS Build (recommended; runs on Expo's infrastructure)
eas build --platform ios --profile production
eas build --platform android --profile production
```

The `eas.json` config defines `development`, `preview`, and `production` profiles. The first EAS Build on a new account requires uploading credentials, which EAS stores securely (never in the repo).

## Consuming the shared package

From any app's TypeScript code:

```ts
// In apps/web, apps/desktop, or apps/mobile:
import { createSupabaseClient } from 'masarx-shared/supabase';
import { t } from 'masarx-shared/i18n';
import type { StudySummary } from 'masarx-shared/types';
```

The package name is `masarx-shared` (defined in `packages/shared/package.json`); pnpm resolves it via the workspace protocol. No build step is needed for `masarx-shared` itself; the apps compile it as part of their own bundle.

## Common workflows

### Adding a new translation key

1. Add the key to `packages/shared/src/messages/ar.json` AND `en.json` in the same PR.
2. Reference it in the app code via the per-runtime helper (`t(...)` on mobile, `useTranslations(...)` on web).
3. Run `pnpm typecheck` to confirm the generated type is consistent.

If you add a key to only one language, the build fails. See [contracts/i18n-messages.md](./contracts/i18n-messages.md).

### Adding a new Supabase query

1. Add the typed query helper in `packages/shared/src/supabase/queries/`.
2. Import the helper from the app code.
3. The query runs through the per-runtime Supabase client; no app-specific auth code is needed.

Do NOT add queries that bypass the shared client. See [contracts/supabase-client.md](./contracts/supabase-client.md).

### Adding a new AI feature

1. Add the request/response types to `packages/shared/src/ai/`.
2. Implement the call in the Edge Function.
3. Expose a typed helper in `packages/shared/src/ai/` for the apps to call.
4. The helper MUST go through the Edge Function; it MUST NOT call the AI provider directly.

See [contracts/ai-boundary.md](./contracts/ai-boundary.md).

## CI

The CI pipeline (GitHub Actions) runs on every PR and on every push to `main`:

1. `pnpm typecheck` (all packages)
2. `pnpm lint` (all packages)
3. `pnpm test` (all packages, all apps)
4. `pnpm build:web`, `pnpm build:desktop`, `pnpm build:mobile` (parallel)
5. `gitleaks detect --no-git --source <each-built-artifact>` — fails the build on any match
6. Smoke tests on the web build (existing Playwright suite, preserved)

A merge to `main` triggers:

7. Deploy the web build to Vercel (existing, unchanged)
8. Build + sign the desktop installers; upload to GitHub Releases (new)
9. Trigger EAS Build for iOS / Android production profiles; submit to App Store / Play Store (new, manual approval step before submit)

## Local secrets during development

Each app reads its own env vars from its own `.env.local` (gitignored). The shared package reads nothing at runtime; it only receives the values passed in by the app at startup. The service role key is only needed in dev for scripts that bypass RLS (e.g., seed scripts) and is never passed to `createSupabaseClient`.

## Troubleshooting

- **`pnpm install` fails with "package not found"**: the shared package isn't symlinked. Run `pnpm install --force` from the repo root.
- **Electron app shows a blank window**: the local Next.js server didn't start. Check `apps/desktop/logs/main.log` and the dev-server output.
- **Expo app crashes on first launch**: check `apps/mobile/app.json` — the `extra.supabaseUrl` and `extra.supabaseAnonKey` must be set.
- **`gitleaks` flags a false positive in CI**: open a PR that adds the false positive to `.gitleaks.toml`'s `allowlist` with a justification comment. Do NOT add the secret to the codebase.

## What this quickstart does NOT cover

- **Production deployment details** (Vercel env vars, EAS environment, GitHub Releases signing). Those are recorded separately in the team's deployment runbook.
- **App Store / Play Store metadata** (screenshots, descriptions, age ratings). The submission is configured; the content is owned by the product team.
- **Localization beyond Arabic and English**. Adding a new language is a one-PR change (add the new JSON file) but the v1 product does not need it.
- **Tablet-specific layouts**. Out of scope per the spec.
- **Push notifications / SRS**. Out of scope per the spec.
