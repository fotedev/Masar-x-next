# 13 — Supabase Edge Functions

> Subagent auditor #13, 2026-11-02. Domain: supabase/functions/* (12 functions + _shared). Scope correction: request-password-reset's two rate-limit RPCs are NOT sequential on the critical path (the email check runs off-HTTP via `EdgeRuntime.waitUntil`).

## Findings

### [EDGE-1] Gemini model names pinned to retired/experimental tiers on the critical AI path

- Priority P1 · Impact H — ai-chat is the streaming TTFT path for chat; summarize-chat and process-pdf are user-facing too. `gemini-pro` (Gemini 1.0 Pro) was deprecated/retired by Google (deprecated Jul 2024, fully retired Apr 2025); `gemini-2.0-flash-exp` is an expired experimental tier. Unless `AI_MODEL` env is set at deploy time, requests fail or fall back unpredictably, surfacing as latency spikes/retries in the core study flow.
- Evidence: `supabase/functions/ai-chat/index.ts:63` `const AI_MODEL = Deno.env.get('AI_MODEL') ?? 'gemini-pro';` · `supabase/functions/summarize-chat/index.ts:100` `genAI.getGenerativeModel({ model: 'gemini-pro' })` (hardcoded, no env override) · `supabase/functions/process-pdf/handler.ts:207` `model: 'gemini-2.0-flash-exp'` with a comment admitting the substitution.
- Current · Fix (minimal): default `AI_MODEL` to a current model (e.g. `gemini-2.5-flash`) and set the env var in prod; replace the two hardcoded names with the same env-backed constant. Effort S. (Note: deployed env values couldn't be verified from the repo — if prod already overrides AI_MODEL, impact drops accordingly.)

### [EDGE-2] upload-file timeout race only covers response headers; body read is untimed and the timer dangles

- Priority P1 · Impact M — The 30s `Promise.race` resolves when `fetch()` returns (headers received). The subsequent `cloudinaryResponse.json()` / `.text()` reads run with no deadline, so a Cloudinary stall after headers hangs the isolate until the platform cap, occupying a worker slot on the upload critical path. If the timeout branch wins, the `setTimeout` still fires later (unhandled rejection + keeps the isolate's timer alive up to 30s).
- Evidence: `supabase/functions/upload-file/index.ts:193-197` (`Promise.race([uploadPromise, timeoutPromise])`); body read at `:260` (`await cloudinaryResponse.json()`) is outside the race.
- Fix: drop the race and pass `signal: AbortSignal.timeout(30_000)` in the `fetch` init (same pattern already used in process-pdf, `handler.ts:159`) — it covers send+headers+body and cancels the socket. Effort S.

### [EDGE-3] upload-file is the only high-cost proxy with no rate limiting

- Priority P2 · Impact M — upload-file proxies up to 50MB bodies through the edge function (base64 JSON → bytes → multipart). It makes zero `check_rate_limit` calls, so each call costs 1 auth roundtrip + full proxy work; abuse is bounded only by auth. The web proxy rate-limits ai-chat (`apps/web/src/app/api/ai-chat/route.ts:76`), but upload-file's edge URL is also called directly by desktop/mobile (multi-platform spec), which bypasses any proxy-side limit.
- Evidence: no `rpc('check_rate_limit'` anywhere in `upload-file/index.ts` (grep across `supabase/functions/` — only process-pdf, request-password-reset, cloudinary-webhook, reset-password call it). 50MB gate at `upload-file/index.ts:121`.
- Fix: one `checkRateLimit` call (reuse `_shared/net.ts:59` wrapper) keyed on `user.id`, e.g. 20/hour, placed after auth. Effort S.

### [EDGE-4] upload-file decodes base64 byte-by-byte; the data-URI shortcut already used by upload-avatar is free

- Priority P2 · Impact M — For a 50MB file the request holds a ~66MB JSON string, then `atob` + a per-character loop materialize a third copy, then Blob/multipart a fourth. The decode loop is pure CPU on the upload latency path. `upload-avatar` sends `data:<type>;base64,<file>` directly with no decode at all.
- Evidence: `supabase/functions/upload-file/index.ts:158-163` (`atob` + per-char loop) vs `supabase/functions/upload-avatar/index.ts:39` `formData.append('file', \`data:${contentType};base64,${file}\`)`.
- Fix: mirror upload-avatar (append the data URI; Cloudinary accepts it), deleting the decode loop. Effort S.

### [EDGE-5] delete-avatar runs Cloudinary destroy and profile update strictly sequentially though they're independent

- Priority P2 · Impact M — Chain is auth.getUser → profiles select → Cloudinary destroy → profiles update; the destroy is explicitly failure-tolerated (log-only), so the update does not depend on its outcome. Awaiting them serially adds one full Cloudinary roundtrip (~100-300ms) to every avatar delete.
- Evidence: `supabase/functions/delete-avatar/handler.ts:107-113` (await destroy) then `:121-127` (await update), with `:115-118` "Don't fail if Cloudinary delete fails, just log it".
- Fix: `await Promise.all([destroy..., update...])` (keep the update's error handling). Effort S.

### [EDGE-6] process-pdf re-resolves DNS on every request and every redirect hop with no short-TTL cache

- Priority P2 · Impact L-M — Necessary security work (fail-closed A+AAAA validation, parallelized), but it runs per request and again per redirect hop with no caching; for the dominant host `res.cloudinary.com` this repeats identical lookups thousands of times.
- Evidence: `supabase/functions/process-pdf/handler.ts:36-53` `hostResolvesPublic` (two `Deno.resolveDns` calls); invoked at `:150` and again per hop at `:174`; allowlist at `:140` `['res.cloudinary.com', ...extraHosts()]`.
- Fix: module-level `Map<host, {ok, expires}>` with a short TTL (30-60s) — security-neutral since the TOCTOU window already exists (documented at `handler.ts:38-41`). Effort S.

### [EDGE-7] deno.lock does not cover the versions actually imported; process-pdf pins a second generative-ai copy

- Priority P2 · Impact L — Cold-start/supply-chain hygiene: lock v5 only redirects `@supabase/supabase-js@2` → `2.117.1` and contains zero entries for `@2.117.2` or any `@google/generative-ai` version, while every function imports the literal `@2.117.2`. So lock integrity/reproducibility doesn't apply to the real imports, and esm.sh resolution is unpinned per deploy. Additionally process-pdf imports `generative-ai@0.21.0` while ai-chat/summarize-chat use `0.24.1` — two separate SDK copies to fetch/bundle.
- Evidence: `deno.lock:4` (`"@2" → 2.117.1`, no 2.117.2 entries — grep count 0); `supabase/functions/process-pdf/handler.ts:2` `generative-ai@0.21.0` vs `ai-chat/index.ts:57` `@0.24.1`; map `supabase/functions/deno.jsonc:10-11` pins 0.24.1 but process-pdf bypasses it.
- Fix: regenerate the lock (or route imports through the import map), and switch process-pdf to the mapped `0.24.1`. Effort S.

### [EDGE-8] Seven functions still boot through deno.land/std@0.168.0 `serve` instead of native `Deno.serve`

- Priority P2 · Impact L — Cold-start only: `std@0.168.0/http/server.ts` is a pinned-2022 remote import adding bundle weight and one extra module hop before the handler is reachable; three functions already use native `Deno.serve` directly with identical behavior.
- Evidence: std `serve` in `ai-chat/index.ts:55`, `process-pdf/index.ts:1`, `request-password-reset/index.ts:2`, `reset-password/index.ts:2`, `summarize-chat/index.ts:2`, `auth-hook-email/index.ts:2`, `cloudinary-webhook/index.ts:2`; native in `upload-file/index.ts:13`, `delete-file/index.ts:14`, `upload-avatar/index.ts:15`.
- Fix: swap to `Deno.serve(handler)` per function (mechanical; process-pdf already exports a plain handler). Effort S.

### [EDGE-9] summarize-chat serializes three DB roundtrips before the AI call; participant check and messages fetch can overlap

- Priority P2 · Impact L-M — auth.getUser → `chat_participants` select → 50-row `messages` select (with `auth.users` join) all run back-to-back before Gemini. The participant check and the messages fetch are independent queries (RLS on messages also enforces participation server-side), so batching them saves one roundtrip (~50-150ms) on a non-streaming, multi-second endpoint.
- Evidence: `supabase/functions/summarize-chat/index.ts:56-61` (participant select), `:68-79` (messages select), AI call at `:145`.
- Fix: `Promise.all([participantQuery, messagesQuery])` then validate. Effort S.

### [EDGE-10] check_rate_limit RPC internally executes DELETE + SELECT + UPSERT per call

- Priority P2 · Impact L — From the function side it is one roundtrip (good), but every invocation runs three statements (see RLS-4 for the full shape and the single-upsert recommendation; RLS-3 for the retention gap).

### [EDGE-11] process-pdf rate-limit check is sequential with body parse, though body parse is independent

- Priority P2 · Impact L — Order is auth.getUser → rate-limit RPC → `req.json()` (`handler.ts:133`). The body parse needs no auth result, so `req.json()` could start in parallel with the RL RPC, saving one roundtrip of latency on a function whose real cost is the PDF fetch + OCR anyway. (RL correctly stays fail-open and after auth.)
- Evidence: `supabase/functions/process-pdf/handler.ts:118-123` (RL), `:133` (body parse).
- Fix: start `const bodyPromise = req.json()` before the RL block, await after. Effort S.

## Healthy areas

- **CORS (`_shared/cors.ts`, `_shared/http.ts`)**: preflight is a pure in-memory header computation returned immediately; allow-list echo + `Vary: Origin` correct; no I/O on the OPTIONS path anywhere.
- **Caller auth (`_shared/auth.ts`)**: exactly one `auth.getUser()` roundtrip per request for the wrapper functions (delete-file, upload-avatar); 401 fires before body parse; token forwarding avoids a second client; no profile query in the shared path.
- **ai-chat streaming path**: real `generateContentStream` with SSE, client-disconnect abort via `cancel()` (`ai-chat/index.ts:221-224`) so abandoned streams stop paying Gemini tokens; cheap guards (forbidden headers, env, validation) run before auth; the Next.js proxy forwards `Accept` and passes SSE through (`apps/web/src/app/api/ai-chat/route.ts:105-127`), and proxy-side rate limiting exists for the web path (`route.ts:76`).
- **request-password-reset rate limiting (correction to briefing)**: the two RPCs are NOT sequential on the critical path — the IP check (`index.ts:175`) runs before the user lookup, but the email check (`index.ts:253`) lives inside `backgroundWork` off the HTTP path via `EdgeRuntime.waitUntil` (`:329-336`). Uniform-response anti-enumeration preserved.
- **cloudinary-webhook ordering**: signature verification (pure crypto.subtle) happens before the rate-limit RPC and any DB work (`cloudinary-webhook/index.ts:43-56`); admin notifications are a single batched insert (`:129`).
- **Rate-limit call sites** all use the single shared RPC wrapper (`_shared/net.ts:59-70`) — one Postgres roundtrip from the function side.
- **Crypto (`_shared/crypto.ts`)**: native `crypto.subtle.digest` for SHA-1/SHA-256 — negligible per-request cost.
- **process-pdf fetch hardening**: capped streaming read (`readCappedBytes`, aborts mid-stream on size), `AbortSignal.timeout(30_000)`, manual redirects with re-validation per hop — the security work doesn't add unbounded latency.

## Notes

- Critical-path summary: ai-chat streaming TTFT pays auth + validation then streams (healthy except model pin, EDGE-1). upload-file is the heaviest user-facing path (EDGE-2/3/4). summarize-chat is non-streaming JSON for a potentially large AI answer — acceptable for a summary action.
- Cold-start: Supabase bundles each function separately; supabase-js is re-included per function (expected), but EDGE-7/8 remove avoidable duplication. `auth-hook-email` is the lightest (no supabase-js import).
- delete-avatar (`handler.ts:95-98`) still hand-rolls the Cloudinary signature instead of calling `_shared/cloudinary.ts:destroyCloudinaryAsset` — code duplication only, no perf effect; not counted against the 12.
- Process-pdf prompt string at `handler.ts:211-221` is mojibake (UTF-8 read as CP1252) — functional risk for OCR quality, out of perf scope but worth flagging to the owner.
