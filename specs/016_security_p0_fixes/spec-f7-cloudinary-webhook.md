# F7 — Cloudinary webhook signature verification (completed)

Date: 2026-09-25
Production function version verified during rollout: v29
Production status: ACTIVE, `verify_jwt=false`

## Production contract

- Gateway JWT remains disabled because Cloudinary notification webhooks do not carry Supabase JWTs.
- The function authenticates the exact raw request body using:
  - `X-Cld-Timestamp`
  - `X-Cld-Signature`
  - `CLOUDINARY_API_SECRET`
- Formula:
  - `SHA(body + timestamp + api_secret)`
- Signature algorithm is selected from digest length:
  - 40 hex characters: SHA-1
  - 64 hex characters: SHA-256
- Replay protection:
  - strict Unix-seconds timestamp
  - absolute clock tolerance of 7200 seconds
  - stale and future timestamps are rejected
- Comparison is constant-time over equal-length decoded digests.
- No `CLOUDINARY_WEBHOOK_KEY` or custom `x-api-key` is required or used.

## Regression behavior

- Missing, invalid, stale, or incorrectly signed requests return `401 Unauthorized`.
- Signed but non-JSON requests return `400 Invalid JSON payload`.
- Non-POST requests return `405 Method not allowed`.
- Signed non-upload requests return success without inserting summaries or notifications.
- Upload processing is unchanged after authentication.

## Tests

- `supabase/functions/cloudinary-webhook/signature_test.ts`: 7/7 passed
- Live production smoke tests against v29:
  - missing headers: `401`
  - invalid signature: `401`
  - stale signed request: `401`
  - SHA-1 non-upload: `200`
  - SHA-256 non-upload: `200`
  - signed invalid JSON: `400`
  - GET: `405`
- Post-smoke production check: `0` Cloudinary-created summaries inserted by smoke payloads.
