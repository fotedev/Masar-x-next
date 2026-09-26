# P0 Closure Ledger — Spec 016 (production-verified items plus documented backlog)

Date: 2026-09-25

## Production-verified closures

### F5 — Password-reset token hardening

- `public.password_reset_tokens.token_hash` exists.
- Plaintext column is nullable.
- Live counts:
  - stored plaintext tokens: `0`
  - outstanding tokens: `0`
- Deployed reset flow stores only the SHA-256 token hash.

### F7 — Cloudinary webhook signatures

- Production `cloudinary-webhook` version verified during rollout: `v29`.
- Status: `ACTIVE`.
- `verify_jwt=false`.
- Authentication uses the exact raw request body with:
  - `X-Cld-Timestamp`
  - `X-Cld-Signature`
  - `CLOUDINARY_API_SECRET`
- Formula:
  - `SHA(body + timestamp + api_secret)`
- SHA-1 digest length selects SHA-1; SHA-256 digest length selects SHA-256.
- Clock tolerance is 7200 seconds; stale and future timestamps are rejected.
- Decoded digests are compared in constant time over equal lengths.
- Live v29 smoke results:
  - missing headers: `401`
  - invalid signature: `401`
  - stale signed request: `401`
  - valid SHA-1 non-upload: `200`
  - valid SHA-256 non-upload: `200`
  - signed invalid JSON: `400`
  - GET: `405`
- Smoke payloads used a non-upload notification and inserted no summaries or notifications.

### F13 — `check_rate_limit`

- `public.check_rate_limit` exists in production.
- Function uses `SET search_path = ''`.
- `rate_limits` contains the expected live test row.
- `request-password-reset`, `reset-password`, and `cloudinary-webhook` call it.

### F17 — Admin analytics authorization

Guarded in production:

- `public.get_admin_analytics_summary()`
- `public.get_content_analytics_internal()`

Pattern:

- `SECURITY DEFINER`
- procedural `public.is_admin()` check
- explicit `unauthorized` failure for non-admins
- `SET search_path = ''`
- revocation from `PUBLIC` and `anon`
- execution granted to `authenticated`

Live HTTP verification confirmed:

- real admin receives the unchanged contracts
- authenticated non-admin receives `unauthorized`
- `anon` has no execute permission

The web client maps `unauthorized` to the existing bilingual admin-dashboard error message.

## Documented P1 backlog

### P1-F8 — Remaining `SECURITY DEFINER` functions without fixed `search_path`

Production inventory on 2026-09-25 found these `SECURITY DEFINER` functions without fixed `search_path`:

- `audit_table_changes`
- `cleanup_expired_reset_tokens`
- `delete_old_ai_chat_messages`
- `handle_auth_user_update`
- `handle_new_user`
- `manual_ai_summarization`
- `remove_user_role_from_metadata`
- `set_user_role`
- `sync_user_role_to_metadata`
- `update_user_display_name`
- `verify_system_access_code`

`handle_new_user` and `set_user_role` are especially important because they touch user roles and authorization metadata. The practical concern is schema-hijacking through an unpinned `search_path`, not a currently demonstrated exploit.

Recommended next step: apply the same F17 pattern in a follow-up spec:

- procedural authorization where applicable
- `SET search_path = ''`
- schema-qualified references
- transaction preflight and rollback before production apply
- real authenticated/admin HTTP tests where applicable

### P1-F15 — Web rate-limiting architecture

F15 remains open with its original classification. It requires a design decision rather than a quick fix:

- standardize on `public.check_rate_limit`
- or introduce distributed Upstash-backed limits for Vercel/Edge workloads
- explicitly document fail-open versus fail-closed behavior per sensitive endpoint

## Known unresolved operational risks

### Possible Cloudinary delivery loss during v28

One old production request returned `500 Server misconfigured` under v28. The available production log query exposed only that v28 event and did not expose newer rows. No Cloudinary-created summaries existed after the later smoke tests.

This is not proof that no real Cloudinary delivery failed during v28. Cloudinary dashboard delivery history is the authoritative source and should be checked manually by the owner.

### F1 production deployment

The branch `fix/security-p0-cves` was not merged into `main` or `origin/main` during this session. The local source uses `next 16.3.6`, but the production Vercel deployment was not independently proven in this session. Merging, pushing, and Vercel deployment remain explicit human decisions.

### F4 live confirmation

F4 code removes enumeration and uses uniform responses. A live known/unknown-email comparison was intentionally withheld pending approval to use only a controlled test mailbox and cleanup. It is expected to run separately with owner-provided test-email addresses and production cleanup.
