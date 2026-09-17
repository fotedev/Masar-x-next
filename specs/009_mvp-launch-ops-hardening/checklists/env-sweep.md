# Checklist: Production Env Sweep + AI Smoke (G3.5, G2.1)

**Commands**: `vercel env ls production --project masar-x-next` (always `--project`; local link is stale). Compare against the table in `.env.example`.

**Executed**: 2026-09-17 via Vercel CLI 57.0.0 (`fotes-projects/masar-x-next`).

## Env vars (production environment)

| Variable | Required | Present? | Value sane? |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | ✅ | Encrypted (not inspectable via CLI list) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | ✅ | Encrypted |
| `DATABASE_URL` | Yes | ✅ | ✅ (verified working end-to-end by the RLS audit, 2026-09-17) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | ✅ | Present (Production+Preview) — gotcha §6 satisfied |
| `DATABASE_URL_IPV4` | — | ✅ | Bonus: pooler URL present |
| `NEXT_PUBLIC_SITE_URL` | Yes | ✅ | Encrypted |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Yes | ❌ **MISSING** | `lib/cloudinary.ts:236` hard-throws without it |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Yes | ❌ **MISSING** | Required by `.env.example` table |
| `CLOUDINARY_API_KEY`/`_API_SECRET`/`_URL` | server-only | ✅ | Server-side Cloudinary creds present |
| `VERCEL_MCP_BYPASS_SECRET` | server-only | ❌ absent | `/api/mcp` fail-closed in prod (by design, `9953135`) — MCP endpoint simply not usable in prod; owner to decide whether to provision |
| `AI_GATEWAY_API_KEY` | flag-equivalent | ❌ absent | This is the actual `ai_chat_disabled` gate (`api/ai/chat/route.ts:61`): absent key → 503 → client falls back to **Puter.js** (the zane client-side path). Consistent with the Puter-first architecture — **owner to confirm intent** |

Also checked: no AI provider keys / service-role key exposed in any `NEXT_PUBLIC_*` var (I1) ✅. Legacy duplicates `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY` (no `NEXT_PUBLIC_` prefix) exist — inert, cleanup optional.

**Gap analysis**: the two missing Cloudinary public vars have no source of truth in local `.env`/`.env.local` either — the entire client-side Cloudinary upload path (and `getCloudinaryUrl` image URLs) cannot work anywhere. Today's uploads evidently go through Supabase Storage/other plumbing. Owner actions:
1. `vercel env add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (+ `_UPLOAD_PRESET`) to Production+Preview with real values, **or** declare Cloudinary retired for MVP and rely on Supabase Storage (then remove them from `.env.example`'s required table).
2. Confirm AI gateway intent (keep Puter-only vs provision `AI_GATEWAY_API_KEY`).
3. Optionally provision `VERCEL_MCP_BYPASS_SECRET` if prod MCP access is wanted.

## AI production smoke (owner-assisted browser session)

- [ ] Logged-in chat round-trip returns a streamed answer (expected path: Puter.js client fallback while `AI_GATEWAY_API_KEY` is absent)
- [ ] 11 rapid requests → 429 rate-limit response (10 req/min per user)
- [ ] Owner confirms AI gateway intent (see gap analysis above)

## Result

| Field | Value |
| --- | --- |
| Sweep date | 2026-09-17 |
| Missing vars | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (real gaps); `VERCEL_MCP_BYPASS_SECRET`, `AI_GATEWAY_API_KEY` (likely intentional absences — owner confirm) |
| Fixes applied | None by agent (values are owner-held); exact `vercel env add` commands listed above |
| AI smoke | Pending owner-assisted session |
| Verdict (PASS/FAIL) | **GAPS FOUND — owner action required before G1.1 upload smoke** |
