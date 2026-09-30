# Spec 016 — Security P0 Fixes (Owner-Approved)

> **Approval:** Owner-approved in conversation on 2026-09-24 following `docs/security/security-audit-2026-09-24.md`. This satisfies I11 (spec-first). MVP Lock category: blocking security bugs + deployment readiness.
> **Branch:** `fix/security-p0-cves` (backup pointer: `backup/pre-security-fixes`).

## Scope (P0 only, per owner ordering)

1. **F1 — Next.js CVEs:** `next` 16.2.1 → 16.3.6 (latest patched 16.x). Align `@next/eslint-plugin-next` + `eslint-config-next` to 16.3.6. Re-run build + unit tests + audit after.
2. **F3 — sharp:** direct dep already at latest (0.35.4); the vulnerable `sharp@0.34.5` is Next's own optional dep → resolved by the next upgrade. Verify via `pnpm audit`.
3. **F4 — user enumeration:** `supabase/functions/request-password-reset/index.ts` — remove `debug` field, uniform response regardless of account existence, add IP-based rate limit applied **before** user lookup.
4. **F5 — plaintext reset tokens:** stop inserting `token` (keep `token_hash` only) + migration `014` to drop NOT NULL, wipe stored plaintext tokens, and invalidate all outstanding tokens.

6. **F17 — admin analytics RPC authorization:** replace the unguarded production definition of `public.get_admin_analytics_summary()` with a `SECURITY DEFINER` function that checks `public.is_admin()` before any analytics query, uses `SET search_path = ''`, and remains executable by `authenticated` but not `anon`. Preserve the existing JSON response shape for admins.
7. **F7 — Cloudinary webhook authenticity:** keep gateway JWT verification disabled for external webhooks, but authenticate the exact raw request body with Cloudinary's `X-Cld-Timestamp` and `X-Cld-Signature` headers. Use `CLOUDINARY_API_SECRET`, support the account's SHA-1/SHA-256 signature format, reject malformed/stale/future timestamps, compare decoded digests in constant time, and fail closed with a generic `401` response.

## Approved production-remediation expansion (2026-09-25)

F7 and F17 are promoted into this owner-approved security/deployment-readiness scope after the gateway regression was reproduced in production.

### Architecture and design

- F17 guards the procedural `SECURITY DEFINER` entry point because RLS is bypassed by that function. All referenced tables are schema-qualified and `search_path` is empty.
- F7 reads `req.text()` once, verifies the signature against those exact bytes, and only then parses JSON. It uses the existing `CLOUDINARY_API_SECRET`; it does not introduce or require the non-standard `CLOUDINARY_WEBHOOK_KEY` header.
- The web client maps the RPC's `unauthorized` error to the existing bilingual analytics unauthorized message rather than showing a generic load failure or crashing.

### Test and regression specification

- Deno tests cover the official SHA-1 and SHA-256 Cloudinary vectors, body mismatch, wrong secret, missing/malformed headers, and stale/future timestamps.
- F17 production preflight runs in a transaction and rolls back: an authenticated non-admin must receive `unauthorized`, while a real admin must receive the prior six-key JSON shape.
- A valid non-upload signed request must return the existing success response without inserting data; unsigned, incorrectly signed, and stale signed requests must return `401`.
- Existing upload processing remains unchanged after authentication.

## Non-goals (P1/P2 — later specs)
F8 (SECURITY DEFINER search_path beyond the F17 function), F9 (token TTL), F2 (vitest), F6 (Electron).

## Git safety protocol (owner-mandated)
- No `reset --hard`, `clean -fd`, `stash pop/drop`.
- Stage files **by name** only; one commit per fix.
- Untracked `specs/015_*` and both stashes must remain untouched.

## Delegation & production-access rule (owner-set 2026-09-24)

Any delegation to an external model **or** any access to production (MCP/CLI/HTTP) requires **explicit owner approval**:

1. **Ask first; a timeout means NO.** An unanswered approval question is a denial — do not proceed on a default (a round-1 model choice was made on timeout and corrected by the owner).
2. **The owner picks the model.** Candidate models are only those the owner has configured/authorised; the orchestrator never guesses.
3. **Briefs must be secret-free.** Verified: project-ref only, no key values (round-1 brief reviewed line by line).
4. **Read-only by default.** Prod access uses a `--read-only` MCP server; the brief forbids file writes and git write commands; the orchestrator re-checks `git status` and `touchedFiles` afterwards.
5. **Orchestrator verifies raw evidence**, never the implementer's self-report (round-1: the report claimed "11 queries" while the raw event log held 16).

- [x] `pnpm install` clean; `pnpm --filter web build` green; `pnpm --filter web test` green. *(Landed as squash `94df7f8`, PR #53, 2026-09-26; Vercel build+deploy confirmed in `docs/audits/git-cleanup-2026-09-26/delivery-report.md`, superseding the closure ledger's "F1 deployment not proven" caveat.)*
- [x] `pnpm audit` no longer lists critical next advisories; sharp advisories cleared or proven unpatched-upstream. *(Re-verified 2026-09-30: zero `next` and zero `sharp` advisories in prod deps. 59 advisories remain in other packages; the single critical is `tar` via `apps/mobile>expo>@expo/cli` — patched ≥7.5.19 upstream, unrelated to spec 016's scope.)*
- [x] Edge function returns identical response for known/unknown emails; no `debug` field; no plaintext token insert. *(Code-verified 2026-09-30: `debug` field removed, insert sends `token_hash` only; production state per closure ledger F5 — 0 stored plaintext tokens, column nullable.)*
- [x] Migration 014 idempotent-safe and RLS-compatible. *(`014_password_reset_token_hardening.sql`: `DROP NOT NULL` + two idempotent `UPDATE`s, no RLS changes; ledger F5 confirms applied in production.)*
- [x] `git status` shows only intended files staged per commit. *(Process gate — git-safety protocol above; squash `94df7f8` file list re-checked 2026-09-30, all entries spec/security-scoped.)*
