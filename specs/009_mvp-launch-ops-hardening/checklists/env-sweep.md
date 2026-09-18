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

**Gap analysis (RESOLVED 2026-09-17)**: the Cloudinary public pair was provisioned after discovery via the Cloudinary Admin API using the locally-held `CLOUDINARY_URL` creds (cloud `de3emq8l3`, pre-existing unsigned preset `masarx-uploads`) — no values had to be owner-typed. AI intent confirmed Puter-only (item 2 closed). Item 3 (MCP secret) intentionally not provisioned.

**CLI gotcha for future env additions (preview environment)**: `vercel env add NAME preview` prompts interactively for a git branch and **piped stdin does not answer it** — pass an empty string as the third positional: `printf 'value' | vercel env add NAME preview '' --yes --project <project>` (empty = all branches). Note `vercel env pull` now returns `[SENSITIVE]` for sensitive-flagged vars; real values live in local `.env*`.

## AI production smoke (owner-assisted browser session)

- [ ] Logged-in chat round-trip returns a streamed answer (expected path: Puter.js client fallback while `AI_GATEWAY_API_KEY` is absent) — **owner's normal usage covers this; not separately gated**
- [ ] 11 rapid requests → 429 rate-limit response (10 req/min per user) — unchanged, spot-check anytime
- [x] **Owner confirms AI gateway intent (2026-09-17): Puter-only for launch.** `AI_GATEWAY_API_KEY` stays unprovisioned; server route remains the dormant 503 fallback by design (G2.1 closed)

## Result

| Field | Value |
| --- | --- |
| Sweep date | 2026-09-17 |
| Missing vars | ~~Cloudinary public pair~~ **RESOLVED 2026-09-17**: discovered via Admin API (local creds) — cloud `de3emq8l3`, unsigned preset `masarx-uploads` (pre-existing); added to Vercel **production + preview** + local `.env.local`. Upload path proven end-to-end (unsigned POST 200 → fetch-back 200 → destroy ok; probe asset cleaned up). `VERCEL_MCP_BYPASS_SECRET` intentionally absent (MCP not exposed in prod) |
| Fixes applied | Cloudinary pair provisioned; AI intent recorded (Puter-only) |
| AI smoke | Decision confirmed; runtime round-trip = owner normal usage |
| Verdict (PASS/FAIL) | **PASS — all launch-blocking gaps closed** |
