# Spec 016 — Security P0 Fixes (Owner-Approved)

> **Approval:** Owner-approved in conversation on 2026-09-24 following `docs/security/security-audit-2026-09-24.md`. This satisfies I11 (spec-first). MVP Lock category: blocking security bugs + deployment readiness.
> **Branch:** `fix/security-p0-cves` (backup pointer: `backup/pre-security-fixes`).

## Scope (P0 only, per owner ordering)

1. **F1 — Next.js CVEs:** `next` 16.2.1 → 16.3.6 (latest patched 16.x). Align `@next/eslint-plugin-next` + `eslint-config-next` to 16.3.6. Re-run build + unit tests + audit after.
2. **F3 — sharp:** direct dep already at latest (0.35.4); the vulnerable `sharp@0.34.5` is Next's own optional dep → resolved by the next upgrade. Verify via `pnpm audit`.
3. **F4 — user enumeration:** `supabase/functions/request-password-reset/index.ts` — remove `debug` field, uniform response regardless of account existence, add IP-based rate limit applied **before** user lookup.
4. **F5 — plaintext reset tokens:** stop inserting `token` (keep `token_hash` only) + migration `014` to drop NOT NULL, wipe stored plaintext tokens, and invalidate all outstanding tokens.

## Non-goals (P1/P2 — later specs)
F7 (Cloudinary webhook HMAC), F8 (SECURITY DEFINER search_path), F9 (token TTL), F2 (vitest), F6 (Electron).

## Git safety protocol (owner-mandated)
- No `reset --hard`, `clean -fd`, `stash pop/drop`.
- Stage files **by name** only; one commit per fix.
- Untracked `specs/015_*` and both stashes must remain untouched.

## Acceptance criteria
- [ ] `pnpm install` clean; `pnpm --filter web build` green; `pnpm --filter web test` green.
- [ ] `pnpm audit` no longer lists critical next advisories; sharp advisories cleared or proven unpatched-upstream.
- [ ] Edge function returns identical response for known/unknown emails; no `debug` field; no plaintext token insert.
- [ ] Migration 014 idempotent-safe and RLS-compatible.
- [ ] `git status` shows only intended files staged per commit.
