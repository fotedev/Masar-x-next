# Spec 021 — Email Waitlist (TRW join + platform "Notify me")

**Status:** Approved (owner, 2026-09-25)
**Type:** Feature (owner-directed under MVP Lock — essential launch data)
**Branch:** feat/020-mobile-polish

## Problem

The footer's "The Real World" (TRW) card sends join requests through WhatsApp with a prefilled message. The /downloads page's macOS/Android "Notify me when available" buttons are disabled no-ops. Owner wants an email waitlist instead: visitors leave their email; signed-in users get their email prefilled.

## Scope

Two touchpoints, one backend table:

1. Footer TRW card → inline email form (replaces the WhatsApp link). Source tag: `trw`.
2. /downloads ComingSoonCards (macOS, Android) → email form replaces the disabled button. Source tags: `macos`, `android`.

The general footer WhatsApp **support** CTA is NOT touched.

## Design

- Table `public.waitlist` (email, source, user_id, created_at) — migration `014_waitlist.sql`. Case-insensitive uniqueness per (lower(email), source). RLS insert-only for anon+authenticated; no read/update/delete policies ⇒ rows are write-only from the client.
- Client validates with `WaitlistSignupSchema` (Zod, `packages/shared`) then inserts via the browser client. Postgres `23505` (unique violation) ⇒ "already on the list", styled as success.
- New i18n namespace `waitlist` (ar/en) — 4-point registration contract: `apps/web/src/i18n/request.ts`, `apps/web/src/i18n.d.ts`, `packages/shared/src/i18n/index.ts`, `packages/shared/src/messages/types.ts`.
- Dead keys pruned: `footer.trwCaption`, `footer.trwWhatsappMessage`, `footer.guestName`, `downloads.platforms.{macos,android}.notifyLabel`.

## Non-goals

- Admin UI for viewing signups (Supabase dashboard is enough for MVP).
- Email sending / notification automation.
- Captcha or rate limiting beyond DB constraints.

## Acceptance

- [ ] Signed-out user can join from the footer TRW card and the downloads cards.
- [ ] Signed-in user sees their email prefilled (editable).
- [ ] Duplicate email+source ⇒ duplicate message, not an error.
- [ ] Invalid email ⇒ inline validation message, no request sent.
- [ ] All new strings exist in ar and en; no new i18n audit hits.
- [ ] Gates: tsc, eslint, web vitest green.
- [x] Migration applied to the linked project (2026-09-25, via Supabase Management API `database/query`). Smoke-tested: RLS anon INSERT OK, REST 201 / 409 duplicate / 400 invalid, anon read returns `[]` (rows unreadable), smoke rows cleaned.

## Deployment note

The remote migration history uses legacy timestamp names (`20260222104332`…) while local files are renumbered `0NN_*` — `supabase migration list` shows zero pairing. **NEVER run `supabase db push` / `migration up` against this project**: it would replay 001–013 onto an already-migrated database. Apply new migrations via the Management API `POST /v1/projects/{ref}/database/query` or the dashboard SQL editor. (Also: the Supabase CLI's stored login belongs to a different account and 403s on `--linked` SQL execution; and OpenCode's Supabase MCP runs with `--read-only`, so it cannot apply DDL either.)
