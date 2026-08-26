# Contributing to Masar X

Thanks for contributing. This document covers the workflows specific to this monorepo: how code is shared across apps, how cross-platform contracts are enforced, and what CI expects before merge.

## Table of contents

- [Development setup](#development-setup)
- [Repository conventions](#repository-conventions)
- [Cross-platform contracts](#cross-platform-contracts)
- [Adding a new shared package](#adding-a-new-shared-package)
- [Adding a new user story](#adding-a-new-user-story)
- [Before you open a PR](#before-you-open-a-pr)

## Development setup

Follow [Getting started](./README.md#getting-started) in the main README for prerequisites, installation, and environment variables.

Quick check that your environment is healthy:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Repository conventions

- **pnpm workspaces only.** Apps live in `apps/`, shared code in `packages/`. Dependencies between them use the `workspace:*` protocol — never publish or install these from a registry.
- **Shared code goes in `packages/shared/`.** Do not import Supabase, AI provider SDKs, or i18n messages directly in an app when an equivalent export exists in the shared package.
- **Design specs live in `specs/NNN-short-name/`** (SpecKit format). Non-trivial features get a spec before implementation.
- **Secrets never enter git.** `.env.local` is gitignored; CI runs gitleaks on both source and built artifacts.

## Releases and installers

This repository holds the **source code** only. Built installers — NSIS setup `.exe`, portable `.exe`, Android `.apk`, `latest.yml`, and blockmaps — are automatically published by the release pipeline to the public [`fotedev/masarx-releases`](https://github.com/fotedev/masarx-releases/releases) repository.

- Do not open issues or pull requests against `masarx-releases` — that repository contains build artifacts, not code. All development happens here.
- Do not look for installer download links in this repository; users get them from the [Download section](./README.md#download) of the README, which points at `masarx-releases`.
- Release version bumps and pipeline triggers are maintainer tasks; see the changelog in [`CHANGELOG.md`](./CHANGELOG.md) for what shipped when.

## Cross-platform contracts

The three apps agree to four internal contracts when sharing code through `packages/shared/`. Each is documented in [`specs/004-multi-platform-expansion/contracts/`](./specs/004-multi-platform-expansion/contracts/):

| Contract | Guarantees |
| ---------- | ------------ |
| [`supabase-client.md`](./specs/004-multi-platform-expansion/contracts/supabase-client.md) | How each runtime gets a Supabase client and what each client may do; the service-role key never reaches a client context |
| [`i18n-messages.md`](./specs/004-multi-platform-expansion/contracts/i18n-messages.md) | How translation messages are shared; the process for adding or renaming keys |
| [`ai-boundary.md`](./specs/004-multi-platform-expansion/contracts/ai-boundary.md) | The AI provider key stays server-side; what clients may and may not do |
| [`README.md`](./specs/004-multi-platform-expansion/contracts/README.md) | Why these are contracts, not helpers, and how to change one |

These are **security boundaries as well as code-sharing conveniences**. A change to any contract is a breaking change to all three apps — see the [contract change checklist](./specs/004-multi-platform-expansion/contracts/README.md#reviewing-changes-to-a-contract).

### Mechanical enforcement

CI enforces the contracts so they cannot be bypassed in review:

| Check | What it does | Severity | Where |
| ------- | -------------- | ---------- | ------- |
| gitleaks (source) | Scans the working tree and push hook for secrets | required | `.gitleaks.toml` |
| ESLint restricted imports | Blocks `openai` / `@anthropic-ai/sdk` outside the Edge Function and shared package | error | `apps/web/eslint.config.mjs` |
| AI endpoint grep | Greps for AI provider endpoint strings outside the Edge Function and test fixtures | required | `.github/scripts/check-ai-provider-endpoints.sh` |
| gitleaks (artifacts) | Scans the post-`next build` tree | required | `.github/workflows/ci.yml` (`gitleaks-artifacts` job) |

Code review is the human layer on top of these checks — the two are not interchangeable.

## Adding a new shared package

The workspace auto-discovers anything under `packages/`. To add one (e.g. `packages/analytics/`):

1. Create the directory with a `package.json` whose `name` is the unscoped name (e.g. `masarx-analytics`), `type: "module"`, and `main`/`types`/`exports` pointing at `./src/index.ts`.
2. Add a `tsconfig.json` — the one in [`packages/shared/tsconfig.json`](./packages/shared/tsconfig.json) is a good template.
3. No workspace registration needed: `pnpm-workspace.yaml` already covers `apps/*` and `packages/*`.
4. From an app, depend on it via `"masarx-analytics": "workspace:*"`. Add a `paths` entry in the app's `tsconfig.json` if you import source directly (see the existing `masarx-shared/*` mapping in `apps/web/tsconfig.json`).
5. If the package crosses a runtime boundary, document its security contract under `specs/<active-spec>/contracts/` **before** it gains consumers — contracts belong in spec docs, not in package READMEs.

## Adding a new user story

1. Add a new spec under `specs/NNN-short-name/`, following the SpecKit template used by existing specs.
2. Identify any new cross-platform code that belongs in `packages/shared/` and write its contract first, mirroring the existing four contracts.
3. Implement the story in the relevant app(s), consuming the shared package. Direct imports of `@supabase/supabase-js`, `openai`, or `@anthropic-ai/sdk` outside their allowed contexts are blocked by ESLint.
4. Update the [Project status](./README.md#project-status) table in the README if the change affects platform availability.

## Before you open a PR

Open your PR against `main` using the [PR template](./.github/PULL_REQUEST_TEMPLATE.md), then confirm:

- `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass locally.
- New env vars are documented in `.env.example` (with scope comments) — never committed as real values.
- Any change touching `packages/shared/` states whether it alters a cross-platform contract.
- Spec-affecting changes update the relevant files under `specs/`.
