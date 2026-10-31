# 🔬 Production database verification — Supabase (MCP, read-only)

> **Date:** 2026-09-24 · **Branch:** `fix/security-p0-cves` · **Project:** `jcufigozkhxazjbwhjjm`
> **Method:** delegation to an external tool (OpenCode CLI, model `dahl/zai-org/GLM-5.3-Flash`) on a **Supabase MCP server in `--read-only` mode** — 16 read-only queries. **The orchestrator reviewed the raw output himself** from `events.jsonl` and did not rely on the tool's self-report.
> **Audit limits:** no writes to the database · no inspection of Auth/SMTP/Redirect URL settings · aggregate counts only (no personal data).

---

## 1) Confirmed facts (Fact Sheet)

| # | Item | Production result | Evidence |
|---|---|---|---|
| V1 | `password_reset_tokens` columns | `id, user_id, email, **token (NOT NULL)**, expires_at, used_at, created_at, updated_at, token_hash` | `information_schema.columns` |
| V2 | Table constraints | `PK(id)` · **`UNIQUE (token)`** · `FK user_id → auth.users ON DELETE CASCADE` | `pg_constraint` |
| V3 | Table indexes | on `email, expires_at, token, token_hash, user_id` — **no UNIQUE on `token_hash`** | `pg_indexes` |
| V4 | **Token data volume** | **`total_rows = 0`** · `rows_token_not_null = 0` · `outstanding_unexpired = 0` · `token_hash_set = 0` | `count(*) FILTER (...)` |
| V5 | RLS | enabled on `password_reset_tokens` and `rate_limits` | `pg_class.relrowsecurity` |
| V6 | `password_reset_tokens` policies | (a) `Service role can manage reset tokens` — ALL/`service_role` (b) **`Users can view their own reset tokens` — SELECT/`authenticated`/`auth.uid() = user_id`** | `pg_policies` |
| V7 | `rate_limits` policy | `Service role can manage rate limits` — ALL/`service_role` only | `pg_policies` |
| V8 | **`rate_limits` shape** | `id, identifier, endpoint, request_count, window_start, created_at, updated_at` — **the old shape** — **no `key`/`hits`/`last_hit`** | `information_schema.columns` |
| V9 | `rate_limits` constraints | `PK(id)` · **`UNIQUE (identifier, endpoint)`** (`ux_rate_limits_identifier_endpoint`) | `pg_constraint` + `pg_indexes` |
| V10 | `rate_limits` rows | **`0` rows** | `count(*)` |
| V11 | **`check_rate_limit(...)`** | **absent from `public`** — `[]` for a name-filtered query without LIMIT | `pg_proc WHERE proname IN ('check_rate_limit','cleanup_rate_limits')` |
| V12 | **`cleanup_rate_limits(...)`** | **absent** (same query) | `pg_proc` |
| V13 | `cleanup_expired_reset_tokens()` | **exists in production only** — `SECURITY DEFINER` · `proconfig = null` (**no `search_path`** — same class as F8) · body: `DELETE FROM password_reset_tokens WHERE expires_at < now() OR used_at IS NOT NULL` | `pg_proc` + `pg_get_functiondef` |
| V14 | Migration ledger | **111 rows** — latest: `20260922231725 semester_management` · `20260920000811 jwt_role_sync` · `20260919003753 p1_hardening` · `20260918230912 …` | `supabase_migrations.schema_migrations` |
---

## 2) 🔴 New findings (not in the audit report)

### F13 🔴 **`check_rate_limit` is absent from production ⇒ every Edge Function rate limit is dead (fail-open)**
- **Impact:** three functions call `supabase.rpc('check_rate_limit', …)`: `reset-password` (30/minute), `request-password-reset` (3/24h per email + 10/hour per new IP), `cloudinary-webhook`. RPC failure → `catch` → **proceeds with no throttling at all**:
  - **unlimited brute-force on `reset-password`** (endless token/password guessing) — the most dangerous item.
  - unlimited password-reset email spam, and unlimited IP attempts.
  - the webhook unthrottled.
- **Corroborating evidence:** `rate_limits` has **zero rows** (V10) — if the function had ever run, there would be rows. The failure is not theoretical.
- **Precision:** the audit is conclusive for schema `public` (the schema exposed via PostgREST); had it lived in another schema, `rpc()` would fail anyway ⇒ the practical result is identical.
- **Proposed fix (needs your approval):** create the function from the text of `migrations.old/20251231200000_add_rate_limiting.sql` **with `SET search_path = ''`** and harden `public.rate_limits` — this closes F13 and F8 together. Then test: `select check_rate_limit('test-ip','test',1,1)` ⇒ `true` then `false`.

### F14 🟠 Production function `cleanup_expired_reset_tokens()` is `SECURITY DEFINER` with no `search_path`
- Absent from the repository entirely (V13) — no code and no local migration covers it (part of the F10 drift).
- **Fix:** include it in the same remediation migration with `SET search_path = ''` + table hardening.

### F15 🟠 The web app's rate-limiting path is **structurally broken** in production
- `apps/web/src/lib/rate-limit.ts` (lines 8-13) declares using a `rate_limits` table with **`key` / `hits` / `last_hit`** columns (the `migrations/006` version). Production has the old columns **`identifier`/`endpoint`/`request_count`/`window_start`** (V8) because the `CREATE TABLE IF NOT EXISTS` in 006 **never executed** (the table already existed from the older 20251231200000).
- ⇒ every POST to `/rest/v1/rate_limits?on_conflict=key` fails structurally ⇒ the code **always** falls back to local memory (per-instance on Vercel) ⇒ the AI-chat limit is ineffective across instances.
- **Your decision:** (a) adapt the code to the production shape (lower risk), or (b) unify the table on the 006 shape.

### F16 🟡 Findings relevant to the in-progress F5/F9 fix
- **`token` is still `NOT NULL`** (V1) ⇒ **the `DROP NOT NULL` in 014 is mandatory before deploying the modified function**, otherwise every reset request fails (the insert no longer sends `token`).
- **The table is empty** (V4) ⇒ the clear/invalidate steps in 014 are **no-ops** — no pending links will be lost (there are none) ⇒ lowers deployment risk.
---

## 3) Corrections to earlier assumptions

| Audit assumption | Confirmed reality |
|---|---|
| "The counter lives in the `rate_limits` table ⇒ works across isolates" | The table has the **right shape** (V8/V9) but **the function is missing** (V11) and the table has zero rows (V10) ⇒ it never works at all. "DB-backed ✅" is true as a design only. |
| "014: clears plaintext + invalidates tokens" | The table is empty ⇒ nothing to clear; what is actually required is **dropping NOT NULL** before deployment (V1). |
| "Production drift = schema" | Broader: **the migration names themselves differ** — 111 timestamped versions with no `NNN` equivalents (V14/V15), which is why `supabase db push` (dry-run) failed. |
| "`check_rate_limit` is defined in `migrations.old` so it lands in production" | That file was never applied (V11/V12) — and the folder is archived, not managed by push. |

---

## 4) What could not be verified (UNCERTAINTIES)

- **No evidence** of `pg_cron` or any scheduler calling `cleanup_expired_reset_tokens` — its existence without a scheduler means it depends on manual invocation.
- **Auth settings** (SMTP, Redirect URLs, built-in GoTrue limits) are outside MCP-read-only scope.
- **Edge Function logs** were not read — F13 could have been confirmed empirically from `check_rate_limit` errors appearing in `function_logs` (suggested next step).
- **Query ordering:** one query (function list with `ILIKE '%rate%'`) returned exactly 20 rows — possibly LIMIT, so the name-filtered queries (V11/V12) were treated as the decisive evidence.

---

## 5) The connected action plan (needs your approval before any write)

1. **New P0:** create `check_rate_limit` in production (the `migrations.old` text + `SET search_path = ''` + harden `public.rate_limits`) — that alone revives every function's limit.
2. **Same window:** record the function locally as `015_rate_limit_function_baseline.sql` so the repo matches production.
3. **Before deploying the modified function:** apply `014` (drop NOT NULL) via the SQL Editor — `db push` is blocked (ledger drift).
4. **F15:** decide between adapting `lib/rate-limit.ts` to the production shape or unifying the table.
5. **F14 + F16-b:** `SET search_path` for the production function + drop the `Users can view their own reset tokens` policy.
6. Empirically verify F13 via `supabase functions logs` (appearance of `check_rate_limit` errors).

> **The complete raw evidence is preserved in** `%TEMP%\opencode-run-supabase-verify\events.jsonl` (16 queries) and `%TEMP%\opencode-run-prod-round2\events.jsonl` (13 queries) for independent review.

---

## 6) Round-two appendix (2026-09-24) — deeper audit of functions and privileges

> Model: `opencode/muse-spark-1.3-contributor-free` (explicit owner approval) · `status: completed` · **zero files changed** (`touchedFiles` = none).

### 6.1 Confirmed facts (W1–W7)

| # | Item | Result | Evidence |
|---|---|---|---|
| W1 | Search across **all schemas** for `check_rate_limit` / `cleanup_rate_limits` | **zero results** — neither function exists in any schema | `pg_proc ⋈ pg_namespace WHERE proname IN (…)` without schema filtering |
| W2 | Migration row `20251231200000` | **recorded** as `add_rate_limiting`, `stmt_count = 7`, and its text does contain the table and function creation | `array_to_string(statements, E'\n')` |
| W3 | Any historical row containing `DROP FUNCTION … check_rate_limit` | **`[]` — none** ⇒ **the function's removal is not recorded in the migration ledger** | regex over `statements` |
| W4 | Rows mentioning `check_rate_limit` | 4 rows: `add_rate_limiting` · `ensure_rate_limits_before_fix` · `fix_rate_limits_unique` · `ensure_rate_limits_table` (all 2025-12-31 → 2026-01-21) | same query |
| W5 | `pg_cron` | **not installed** (`pg_extension` contains only `pg_net 0.19.5`) ⇒ **no scheduling at all** | `pg_extension` |
| W6 | Privileges of `cleanup_expired_reset_tokens()` | `proacl = {=X/postgres, postgres=X/postgres, **anon=X**, **authenticated=X**, service_role=X}` ⇒ **`anon` and `authenticated` hold EXECUTE** | `pg_proc` + `has_function_privilege` |
| W7 | Privileges of `admin_migrate_student_semesters(int,bool)` | same: `anon=X, authenticated=X` — **but** the body is internally guarded: `IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'` + `SET search_path = public` (013:77-84) ⇒ **not exploitable** | `pg_proc` + code of 013 |
| W8 | Inventory of `public` `SECURITY DEFINER` functions callable by `anon` | **10+ functions** (list truncated at 900 chars): `admin_migrate_student_semesters` · `audit_table_changes` · `cleanup_expired_reset_tokens` · `delete_old_ai_chat_messages` · `get_admin_analytics_summary` · `get_content_analytics_internal` · `handle_auth_user_update` · `handle_new_user` · `is_admin` · `is_trw_member` … | `has_function_privilege('anon', oid, 'EXECUTE')` |

### 6.2 Inferences (facts → conclusion)

- **The `rate_limits` table was genuinely created** (W2/W8) but **the function was never created, or was removed without a trace in the ledger** (W1/W3/W4). The most accurate description: *recorded as applied, the function is absent, and the removal is unexplained* — part of the F10 drift.
- The file `migrations.old/20260121055000_ensure_rate_limits_table.sql` explicitly states the two functions "are assumed to exist" — i.e. the team implicitly knew of the absence on 2026-01-21 and never fixed it. **The absence is 8 months old, not a new incident.**
- **No scheduling at all** (W5) ⇒ had the custom reset path been used, `password_reset_tokens` rows would **accumulate uncleaned**. **Zero rows ⇒ the custom path was never used once** (full agreement with the callers-round result: the web uses stock GoTrue).
- **`get_admin_analytics_summary`** (`migrations.old/20251227074230…`) literally contains the developer comment "Check if user is admin … The RLS policies will handle access control" and is `SECURITY DEFINER` **with no `search_path` and no internal check** ⇒ **RLS is not enforced inside a `SECURITY DEFINER` function** ⇒ an anonymous call could return the platform's analytics summary. **Executability temporarily unconfirmed:** it needs confirmation that the `analytics` and `assistant_messages` tables exist in production (if absent, the function fails at runtime).

### 6.3 F13 severity correction (after the owner's review)
| Previous statement | Correction |
|---|---|
| "unlimited brute-force on `reset-password` — the most dangerous item" | **Overstated.** The token = `nanoid(32)` over a 64-char alphabet = **192 bits of entropy** ⇒ token guessing is practically impossible; the security failure is not the rate limit but the verification (which is sound via the hash). |
| The real impact of the dead limits | (a) `request-password-reset` = an **email-spam amplifier** with no cap (each call = a real Brevo email + an admin lookup in auth) on a public path with no JWT; (b) unbounded database work; (c) no protection against automated abuse. |
| A mitigating fact | The custom reset path is **unused on the web**: `login/page.tsx:160` → `resetPasswordForEmail` then `reset-password/page.tsx:71-80` → `exchangeCodeForSession` + `updateUser` (stock GoTrue). The two functions remain a **public attack surface** (`verify_jwt=false`) so they must be fixed, not deleted without verification. |

### 6.4 F17 🟠 (new): `EXECUTE` granted to `anon`/`authenticated` on `SECURITY DEFINER` functions in `public`
- **Reality (W6/W8):** the inventory shows **10+** `SECURITY DEFINER` functions in `public` with the default privilege base (`=X/postgres`) ⇒ `anon` and `authenticated` hold EXECUTE ⇒ each is **callable from PostgREST without authentication** (`POST /rest/v1/rpc/<fn>`).
- **Confirmed risk on `cleanup_expired_reset_tokens`:** any anonymous visitor executes a DELETE on `password_reset_tokens` (limited to expired/used rows — low impact, but it is **unauthenticated deletion**).
- **Potential, unconfirmed risk:** `get_admin_analytics_summary` · `get_content_analytics_internal` (analytics leak if there is no internal check and their tables exist) · `delete_old_ai_chat_messages` (deletion) · `audit_table_changes` · `handle_auth_user_update`.
- **The honorable counter-example:** `admin_migrate_student_semesters` is internally guarded (`is_admin()` + `search_path=public`) — the correct pattern exists in the newer code (013) and should be generalized.
- **The standard fix:** `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon, authenticated;` + `GRANT EXECUTE … TO service_role` + `SET search_path = ''` with full qualification. **Every function must be inventoried individually**: some are called from the UI via `rpc()` (`is_admin`, `is_trw_member`) — revoking those would break the UI.

### 6.5 Open questions (need a third round before any REVOKE)
1. Bodies of `get_admin_analytics_summary` · `get_content_analytics_internal` · `delete_old_ai_chat_messages` · `audit_table_changes` · `handle_auth_user_update` — do they contain an internal `is_admin()`/`auth.uid()` check? Do they have `SET search_path`?
2. Existence of the `analytics` and `assistant_messages` tables in production (decides whether the analytics leak is executable).
3. Which `rpc()` functions the code actually calls — to define the safe REVOKE list.





---

## 7) Round-three appendix (2026-09-24) — pre-execution gate + function-body audit

> Model: `opencode/muse-spark-1.3-contributor-free` (at the owner's request) · `status: completed` · **zero files changed** · 12 read-only queries · **no `set role`/writes executed**.

### 7.1 Phase-1 preconditions — all read and confirmed

| Required check | Result | Verdict |
|---|---|---|
| `rate_limits` columns | `id` · `identifier` · `endpoint` · `request_count` · `window_start` · `created_at` · **`updated_at` ✅ present** | `DO UPDATE SET updated_at = now()` is valid |
| Unique index for `ON CONFLICT (identifier, endpoint)` | **`ux_rate_limits_identifier_endpoint` = UNIQUE (identifier, endpoint)** ✅ | **the blocker is resolved** — the function will work at runtime |
| RLS on `rate_limits` | `relrowsecurity = true` ✅ | matches |
| `anon` privileges on the table | SELECT/INSERT/UPDATE/DELETE = **true** (via PUBLIC) — but **RLS is default-deny** (the only policy is for `service_role`) ⇒ **no row access** | **REVOKE** required for defense-in-depth as requested |
| `authenticated` privileges | same (true ×4) | same action |
| `role_table_grants` | returned `[]` even though `has_table_privilege` = true | **a limitation of this view** for ACLs granted via PUBLIC; the decisive references are `has_table_privilege` + `relacl` |

### 7.2 Audit of the exposed function bodies — conclusive result

| Function | Internal check? | `search_path` | Callable via PostgREST? | Verdict |
|---|---|---|---|---|
| `get_admin_analytics_summary()` | **❌ none** — the developer comment "Check if user is admin … RLS policies will handle access control" with no code behind it | **null** | ✅ yes (`returns json`) | **🔴 F17-a confirmed: an anonymous visit returns the platform's analytics summary** (active-user counts from `auth.users`, views/clicks, top-10 content, last-20 activity). The tables really exist ⇒ **executable, not theoretical** |
| `get_content_analytics_internal()` | ❌ none | ✅ `public` | ✅ yes (`returns table`) | 🟠 per-content view/click counts without authentication |
| `delete_old_ai_chat_messages()` | ❌ none | **null** | ✅ yes (`returns void`) | 🟠 **an anonymous visitor can delete chat messages older than 30 days** (`DELETE FROM public.ai_chat_messages`) |
| `audit_table_changes()` | n/a (trigger) | **null** | ❌ `returns trigger` (not exposed) | 🟡 add `search_path` only |
| `handle_auth_user_update()` | n/a (trigger) | **null** | ❌ `returns trigger` | 🟡 add `search_path` only |
| `is_admin()` / `is_trw_member()` | — | ✅ `search_path=public` | ✅ but **with no parameters** ⇒ reads `auth.uid()` only | **left as-is** — the owner's question is answered: no variant accepting `user_id` exists |

### 7.3 Tables and privileges
- **Zero tables in `public` without RLS** ✅ (`B7 = []`).
- The `anon` table-privilege query (`role_table_grants`) returned `[]` — the same view limitation as 7.1; **it is not read as proof of absence**.

### 7.4 Phase 1 (corrected after the owner's review) — all preconditions confirmed

```sql
begin;

-- (1) lift the constraint blocking new inserts  [safe: 0 rows]
alter table public.password_reset_tokens alter column token drop not null;

-- (2) strengthen the lookup key + prevent concurrent sessions on the same token_hash
alter table public.password_reset_tokens alter column token_hash set not null;
create unique index if not exists ux_password_reset_tokens_token_hash
  on public.password_reset_tokens (token_hash);

-- (3) defense-in-depth on the rate-limit table (RLS already blocks, but grants exist)
revoke all on table public.rate_limits from anon, authenticated;

-- (4) revive check_rate_limit — empty search_path + qualified names + make_interval
create or replace function public.check_rate_limit(
  p_identifier text, p_endpoint text,
  p_max_requests integer default 10, p_window_minutes integer default 1
) returns boolean language plpgsql security definer set search_path = '' as $$
declare current_count integer; window_cutoff timestamptz;
begin
  window_cutoff := now() - make_interval(mins => p_window_minutes);
  delete from public.rate_limits
   where identifier = p_identifier and endpoint = p_endpoint
     and window_start < window_cutoff;
  select coalesce(request_count, 0) into current_count from public.rate_limits
   where identifier = p_identifier and endpoint = p_endpoint
     and window_start >= window_cutoff;
  if current_count >= p_max_requests then return false; end if;
  insert into public.rate_limits (identifier, endpoint, request_count, window_start, updated_at)
  values (p_identifier, p_endpoint, 1, now(), now())
  on conflict (identifier, endpoint) do update
    set request_count = public.rate_limits.request_count + 1, updated_at = now()
    where public.rate_limits.window_start >= window_cutoff;
  return true;
end $$;

revoke all on function public.check_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text,text,integer,integer) to service_role;

commit;
```
**Confirmed preconditions for this transaction:** `ux_rate_limits_identifier_endpoint` exists (B2) · `updated_at` exists (B1) · the three functions call with service_role (verified locally) ⇒ the REVOKE is safe.

**Post-execution test, before deploying the functions:**
```sql
select public.check_rate_limit('__t','__t',1,1);   -- expected: true
select public.check_rate_limit('__t','__t',1,1);   -- expected: false  ← if true, do not deploy
select has_function_privilege('anon','public.check_rate_limit(text,text,integer,integer)','EXECUTE'); -- false
delete from public.rate_limits where identifier='__t';   -- intentional write: clean up the test row
```

**Immediately after deploying the functions (the plaintext window):** run the SQL the owner requested (update `expires_at` then `token = null`) — the 014 version in the repo; then drop the column after 24 hours, and record `supabase migration repair` to avoid new drift.

**Monitoring:** the limits are live for the first time ⇒ watch the logs of the three functions. The most sensitive are `reset-password` (30/min per IP) and `cloudinary-webhook` (120/min — and **Cloudinary sends from shared IPs** ⇒ a real chance of rejecting legitimate bursts; consider removing the limit from the webhook and relying on HMAC/F7 instead).

### 7.5 Phase 4 (corrected after the body inventory)
| Function | Final action |
|---|---|
| `get_admin_analytics_summary` | **add `IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'`** + `set search_path = ''` qualifying `public.analytics`, `public.assistant_messages`, `auth.users` + **REVOKE from `anon` only** (the browser calls it as authenticated) |
| `get_content_analytics_internal` | same check + REVOKE from `anon, authenticated` (no code calls it) |
| `delete_old_ai_chat_messages` | `set search_path=''` + REVOKE from `public, anon, authenticated` + GRANT to `service_role` (no cron and no code) |
| `cleanup_expired_reset_tokens` | same treatment |
| `audit_table_changes` / `handle_auth_user_update` | `set search_path=''` only (names already qualified: `public.audit_logs`, `public.profiles`) |
| `is_admin` / `is_trw_member` | **no change** (RLS depends on them, and they take no parameters) |

---

*Translated from the Arabic original to English on 2026-10-31 (owner request); technical content unchanged.*
