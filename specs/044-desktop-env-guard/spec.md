# Spec 044 — Desktop Env Guard (blank-page hotfix hardening)

> | | |
> |---|---|
> | Branch | `feat/044-desktop-env-guard` |
> | Created | 2026-11-12 |
> | Status | Approved (owner, 2026-11-12 — plan approval in session) |
> | Type | Build-time guard (`apps/web`) — no runtime code changes |
> | Baseline | `main` `53e8c5f` |

## Problem

The installed desktop app v0.6.0 (packaged 2026-11-10 from the `eb26` worktree,
which lacked `apps/web/.env.local` — untracked files don't propagate to
worktrees) shipped a Next.js standalone bundle with neither
`NEXT_PUBLIC_SUPABASE_URL` nor `NEXT_PUBLIC_SUPABASE_ANON_KEY` inlined. Every
page request throws inside the Supabase client — caught in the proxy
(`[ERROR] Proxy error`), uncaught in `[locale]/layout.tsx` (`getCachedUser()`)
→ SSR digest → the bare unstyled `global-error.tsx` ("Something went wrong!")
on a blank page.

`next build` silently succeeds with empty values, so neither the worktree
packaging path nor a CI release with unset secrets would ever fail loudly.
CI's `next-build` job is unaffected by this guard (job-level placeholder env,
non-empty), and `.github/workflows/release.yml` already wires the real secrets
(verified 2026-11-12 via `gh secret list`).

## Scope

**In:**

1. `apps/web/next.config.mjs`: throw during config evaluation when
   `NEXT_PHASE === "phase-production-build"` and either required var is
   missing/empty. The error names both vars, explains build-time inlining,
   and points at `apps/web/.env.local` (worktrees must copy it) and the
   release.yml secrets.
2. `specs/044-desktop-env-guard/spec.md` (this file).

**Out:**

- `release.yml` unchanged — secrets verified present (2026-11-12).
- No `[locale]/error.tsx` styled boundary — optional follow-up; the bare
  `global-error` failure mode is now prevented at build time.
- `[locale]/layout.tsx` `getCachedUser()` left unguarded — the guard makes the
  root cause unreachable at packaging time.

## Verification

1. Scrubbed build (required vars unset + `.env.local` renamed) fails fast at
   config evaluation with the guard error — replicating the eb26 worktree
   condition.
2. Build with `.env.local` present passes (Next 16.4.3 loads env files before
   evaluating the config: `- Environments: .env.local` logs before
   `Running next.config.mjs`).
3. Web vitest suite green.
4. CI green on the PR (every existing CI build path sets non-empty vars:
   `next-build` job-level placeholders, gitleaks-job placeholders,
   `vars.NEXT_PUBLIC_*` for the production-server smoke, lighthouse
   schedule-only).
