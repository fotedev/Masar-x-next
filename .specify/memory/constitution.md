# Masar X Constitution

## Core Principles

### I. Server-Only Secrets (NON-NEGOTIABLE)
Service-role and AI provider keys stay server-side only. NEVER in `NEXT_PUBLIC_*`, never in chat/CLI args, never in client bundles. RLS depends on it; CI enforces via `ai-endpoint-grep` + gitleaks. AI default path is client-side Puter.js (no server key leak); `/api/ai/chat` is a graceful fallback, not a real LLM proxy.

### II. End-to-End Type Safety
`Database` types + Zod schemas live in `packages/shared` as the single source of truth across web/desktop/mobile. No parallel type definitions in apps. Spec contracts that touch data MUST reference shared types.

### III. Bilingual by Design (NON-NEGOTIABLE)
Every user-facing string has `ar` + `en` entries under `packages/shared/src/messages/`. No hardcoded Arabic (or English UI copy) in components — migrate on touch. Components use logical CSS (`ms-`/`me-`/`border-e-`), never physical `left`/`right`; `next-intl` owns `<html dir>`.

### IV. Platform Boundaries
Web (`apps/web`, Next.js 16 + React 19) is the source of truth for product behavior; desktop (Electron) and mobile (Expo/RN) are feature-parity ports. All OAuth callbacks live under `[locale]/auth/callback/`. Storage is Cloudinary (PDFs + images). Releases: web → Vercel; desktop + mobile → GitHub Releases via `.github/workflows/release.yml`.

### V. Pinned, Reproducible Toolchain
`pnpm.neverBuiltDependencies` lives in root `package.json` under `"pnpm"`. Electron version is pinned exact (no `^`/`~`) in `apps/desktop/package.json`. Node >= 24, pnpm 9.15.4. New deps MUST update `pnpm-lock.yaml` via `pnpm install`. Supabase migrations MUST be timestamp-prefixed and chronologically ordered.

### VI. Theme & Correctness Details
Theme switching uses the native `<script>` + `suppressHydrationWarning` pattern in `ThemeScript.tsx` (dark mode is calibrated for late-night study, not inverted). Re-read the ThemeScript/CSP gotcha before touching it or CSP nonce handling.

### VII. Safe Version Control
Never destructive git ops (`stash drop`, `reset --hard`, `checkout --`, `clean -fd`) on a dirty tree without explicit user consent.

## Technology Constraints

- Stack: Next.js 16 / React 19 monorepo (`apps/web`, `apps/desktop`, `apps/mobile`, `packages/shared`); Supabase (Postgres + RLS, Auth, Storage, Edge Functions); `next-intl` with 42 message namespaces.
- Supabase project ref `jcufigozkhxazjbwhjjm`; `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel production env, not just `.env.local`.
- Specs live in `specs/` (currently `001`–`007`); every spec change follows Spec Kit workflow (spec → plan → tasks), not ad-hoc code.

## Development Workflow & Quality Gates

Before opening a PR: `pnpm typecheck`, `pnpm lint` (security-guard rules fail the build), and `pnpm test` MUST pass. No hardcoded Arabic strings added (grep `apps/web/src`). Supabase changes require a current timestamped migration. Reviewers verify constitution compliance (I–VII) on every spec PR.

## Governance

This constitution supersedes ad-hoc practices; `AGENTS.md` + `docs/agents/references/01-gotchas.md` are runtime guidance, not overrides. Amendments require a documented reason, approval, and a migration plan for affected specs. Complexity (new apps, deps, workflows) must be justified against parity and reproducibility.

**Version**: 1.0.0 | **Ratified**: 2026-09-10 | **Last Amended**: 2026-09-10
