# Checklist: Production Env Sweep + AI Smoke (G3.5, G2.1)

**Commands**: `vercel env ls production --project <project>` (always `--project`; local link is stale). Compare against the table in `.env.example`.

## Env vars (production environment)

| Variable | Required | Present? | Value sane? |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | _pending_ | _pending_ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | _pending_ | _pending_ |
| `DATABASE_URL` | Yes | _pending_ | _pending_ |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | _pending_ | _pending_ (gotcha §6) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Yes | _pending_ | _pending_ |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Yes | _pending_ | _pending_ |
| `NEXT_PUBLIC_SITE_URL` | Yes | _pending_ | _pending_ |
| `VERCEL_MCP_BYPASS_SECRET` | server-only | _pending_ | _pending_ (fail-closed since `9953135`) |
| `ai_chat_disabled` | flag | _pending_ | intended value? |

Also checked: no AI provider keys / service-role key exposed in any `NEXT_PUBLIC_*` var (I1).

## AI production smoke (owner-assisted browser session)

- [ ] Logged-in chat round-trip returns a streamed answer
- [ ] 11 rapid requests → 429 rate-limit response (10 req/min per user)
- [ ] `ai_chat_disabled` value matches owner intent (chat enabled for launch?)

## Result

| Field | Value |
| --- | --- |
| Sweep date | _pending_ |
| Missing vars | _pending_ |
| Fixes applied | _pending_ |
| AI smoke | _pending_ |
| Verdict (PASS/FAIL) | _pending_ |
