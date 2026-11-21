# Spec 055: Brand-string sweep — tenant-dynamic prompts in ZANE (web + ai-chat edge)

> Status: Owner-directed execution 2026-11-21 (ANU-X roadmap doc [03](https://github.com/Masar-X/Masar-x) — `sandbox/masarx-anux-plan/03-brand-string-sweep.md`; injection principle + edge carrier decisions locked 2026-11-21 in `00-checklist.md`).
> Numbering: derived from disk — `specs/` ends at `053-desktop-visual-parity`; 054 is claimed by merged PR #269 (spec 054), 051 by open PR #254. Next free number = 055.
> Companion: doc 03 marks the non-prompt sweep as a lightweight grep-sweep batch (no separate spec) — it rides in this spec's §2.4 disposition table.

## 1. Context & problem statement

The multi-tenant roadmap (specs 052 → 054) parameterizes the marketing surfaces, but **ZANE's own voice is still hardcoded to "Masar X"**. On a future ANU-X deployment a student opens the assistant and ZANE introduces itself as a Masar X platform assistant — exactly the drift doc 03 exists to prevent:

| File | Line | Hardcoded string |
|---|---|---|
| `supabase/functions/ai-chat/pure.ts` | 91-94 | `'You are the Zane assistant inside the Masar X platform. '` (Gemini `systemInstruction`) |
| `apps/web/src/app/api/ai/chat/route.ts` | 44 | `'You are the Masar X platform assistant. …'` (`buildSystemPrompt('student_agent')`) |
| `apps/web/src/lib/ai/assistant.ts` | 254 | `` `أنت مساعد طلابي داخل منصة مسار X.` `` (student-agent Arabic prompt) |

**Locked decisions (owner, 2026-11-21):**
- Injection principle: pass the active brand name dynamically so ZANE identifies as the active tenant (ANU-X vs Masar-X).
- Edge carrier: dynamic payload injection with a server-side allowlist (never trust client free text). Option (a) of doc 03.
- Prompt strings use a **dedicated prompt-specific key** (doc 03 recommendation) so prompt strings and marketing strings can drift independently.

**Constraint inherited from doc 02:** the `anu-x` preset slug does not exist yet (doc 02's rename is a separate track; BIS naming still open). This spec therefore builds the **id-agnostic mechanism** — names always resolve through `faculty.json` / the edge allowlist map — so when doc 02 lands `anu-x`, the prompts update without touching this code.

## 2. Architecture & design

### 2.1 Dedicated prompt key in the `faculty` namespace

- `packages/shared/src/messages/{ar,en}/faculty.json`: every preset gains `promptPlatformName` — the bare platform name as ZANE should say it, distinct from `displayName` (marketing):
  - ar: `"FCAI ASNU X"`, `"BIS X"` (Latin names read correctly inside Arabic prompts: «داخل منصة FCAI ASNU X»)
  - en: `"FCAI ASNU X"`, `"BIS X"`
  - Core fallbacks (no preset active) are **not** JSON keys — they stay hardcoded in the prompt builders (`"مسار X"` / `"Masar X"`) so core behavior is self-contained.
  - When doc 02 lands, it writes `promptPlatformName: "ANU-X"` / `"انيو اكس"` for the new preset — one JSON entry, zero code change here.
- The namespace is already registered (spec 052: `MESSAGE_NAMESPACES`, i18n registry, request loaders); adding keys inside existing preset objects does not change the namespace contract. ar/en shape parity is enforced by the existing spec-040 parity test.

### 2.2 Web prompt-brand resolver (`apps/web/src/lib/ai/prompt-brand.ts`)

New tiny module following the `canned-messages.ts` discipline (non-React, static JSON imports, locale-prefix pick):

```ts
getFacultyPromptBrand(locale?: string): string | undefined
```

- Resolves `resolveFacultyPresetIdFromEnv()` (safe server + client: `NEXT_PUBLIC_*` is inlined at build).
- Preset active → reads `faculty.json` → `promptPlatformName` for that preset id in the given locale (`ar` prefix → ar table, else en). Missing key → `undefined`.
- No preset / unknown env → `undefined` (caller keeps its core default).

### 2.3 Web prompt builders (2 of 3 sites)

- **`apps/web/src/lib/ai/assistant.ts`** — extract the student-agent Arabic prompt into an exported, unit-testable builder:

  ```ts
  export const buildStudentAgentSystemPrompt = (platformBrand: string): string => { … }
  ```

  `generateStudentAgentResponse` calls it with `getFacultyPromptBrand(options.locale) ?? "مسار X"`. With the core default the rendered prompt is **byte-identical** to today's literal (`أنت مساعد طلابي داخل منصة مسار X.`). Only the first sentence changes — the rules body, data-channel framing, and tail reinforcement are untouched.

- **`apps/web/src/app/api/ai/chat/route.ts`** — `buildSystemPrompt(mode, platformBrand?)` gains an optional second parameter (spec-040 export note preserved); the `student_agent` branch renders `You are the ${platformBrand ?? "Masar X"} platform assistant. …`. `POST` passes `getFacultyPromptBrand()` (server route, locale-less → en). Default path byte-identical.

### 2.4 Edge `ai-chat`: allowlisted payload injection (option a)

- **Contract** (`packages/shared/src/ai/types.ts`): `AiRequest.context` gains `facultyId?: string` — documented as *server-resolved by the web proxy; other platforms omit it; the edge allowlists it*.
- **Web proxy** (`apps/web/src/app/api/ai-chat/route.ts`): after body validation, the proxy **overwrites** `context.facultyId` with `resolveFacultyPresetIdFromEnv() ?? undefined` — server-derived from the deployment env, so any client-supplied value is discarded (zero trust). With no preset the key is `undefined` and `JSON.stringify` drops it → payload byte-identical to today.
- **`supabase/functions/ai-chat/pure.ts`**:
  - `AI_CHAT_CORE_PLATFORM = "Masar X"` (single source of the core edge name).
  - `AI_CHAT_FACULTY_PLATFORMS: Record<string, string>` — duplicated id → platform-name map (`fcai-asnu`, `bis`). Duplicated deliberately: the deployed edge bundle cannot import `packages/shared` TS (doc 03). Drift is guarded by a harness test (§4).
  - `resolveAiChatPlatformName(raw: unknown): string` — `typeof raw === "string"` **and** exact membership in the map → mapped name; everything else (missing, wrong type, unknown id, whitespace) → core. Exact match only, no normalization — the only legitimate sender is the web proxy, which sends exact preset ids.
  - `buildSystemInstruction(languageInstruction, platformName = AI_CHAT_CORE_PLATFORM)` → `'You are the Zane assistant inside the ${platformName} platform. ' + …`. Default byte-identical.
- **`supabase/functions/ai-chat/index.ts`**: `const platformName = resolveAiChatPlatformName(body.context?.facultyId)` threaded into `buildSystemInstruction` (both streaming and non-streaming call sites use the same already-built instruction, so one change covers both).
- **Mobile/desktop**: their senders don't add `facultyId` → core "Masar X". Correct: spec 052 keeps those surfaces Masar-X-only.
- **Edge deploy**: edge functions are owner-owned deployments — after merge, redeploying `ai-chat` is an owner step (noted in the PR).

### 2.5 Non-prompt sweep — disposition table (lightweight batch, verified on `ff5adeb`)

| Site | Verified content | Disposition |
|---|---|---|
| `apps/web/public/sw.template.js:212,231` | Push-notification fallbacks `data.body \|\| "إشعار جديد من Masar X"`, `data.title \|\| "Masar X"` | **Genericize** — brand-neutral fallbacks (`"إشعار جديد"`, empty title) so one service worker serves all tenants. Push senders own real titles/bodies. (`public/sw.js` does not exist on disk — build-time artifact.) |
| `apps/web/src/app/api/mcp/route.ts:69,80` | MCP server responses ("Masar X — Developer AI Assistant Project") | **No-op** — core developer/owner surface; describes the *project*, not the tenant. |
| `apps/web/src/components/DynamicLogo.tsx:28` | `alt = "Masar X Logo"` default prop | **No-op** — correct core fallback; per-tenant logo assets + alt are doc 01's scope. |
| `apps/web/src/components/admin-shell/{AdminTopbar,AdminOverviewTab,Sidebar}.tsx`, `useAdminTheme.ts` | Comments / owner-tooling identity notes only | **No-op** — admin is owner tooling (spec 052). |
| `apps/web/src/app/[locale]/_components/DesktopAppBannerClient.tsx:66` | Comment only | **No-op** — desktop stays Masar X-branded (spec 052); the banner advertises the Masar X desktop app correctly on any deployment. |
| `apps/web/src/lib/github-releases.ts:2,108`, `sw-register.ts:6`, `desktop/runtime.ts:31` | Doc comments + one user-facing error string on `github-releases.ts:108` (desktop-releases page) | **No-op** — all Masar-X-only surfaces per spec 052. |
| `apps/web/public/llms.txt` | Core-brand document | **No-op** — owner decision still open (per-tenant vs core-only); documented as owner-owed in the roadmap. |
| `manifest.ts` / `FooterBrand` core fallbacks | Core preset fallback values | **No-op** — correct by design (spec 052 core value). |

## 3. Behavior preservation & regression strategy

- **Core deployments (no `NEXT_PUBLIC_FACULTY`)**: all three prompts and the edge `systemInstruction` render **byte-identical** to today; the proxy payload drops the new key. Locked by default-argument unit tests that assert the exact current strings.
- **Faculty deployments**: prompts resolve the preset's `promptPlatformName`; garbage/unknown/missing facultyId at the edge → core (exact-match allowlist).
- **Spec 050 regression surface untouched**: the `<user_message>` data-channel framing, role boundary, and data rule move with the prompt template verbatim; only the brand token is parameterized.
- **Contract compatibility**: `context.facultyId` is additive-optional; old clients (mobile/desktop/current web) that omit it keep working; the edge ignores unknown fields it doesn't read.
- **Streaming**: `buildSystemInstruction` is built once per request before both modes branch — SSE and JSON responses share the same instruction path as today.

## 4. Test specification

**Shared (`packages/shared`)**
- Extend the faculties JSON test: every preset in both locales has a non-empty string `promptPlatformName` (shape parity ar/en).

**Web unit (vitest)**
- `prompt-brand.test.ts`: no env → `undefined`; preset env → expected name; unknown env → `undefined`; `ar`/`en` locale pick; stubbed via `NEXT_PUBLIC_FACULTY`.
- `buildStudentAgentSystemPrompt`: core default → byte-equal to the current literal (snapshot of the first sentence); preset brand → substitution only in the first sentence; rules body unchanged.
- `buildSystemPrompt`: `('student_agent')` default → contains `Masar X` (existing assertions preserved); `('student_agent', 'ANU-X')` → contains `ANU-X` platform assistant; other modes ignore the parameter.
- Proxy route test: env set → forwarded body carries `context.facultyId = <preset>`; client-supplied `facultyId` is overridden; env unset → forwarded body has no `facultyId`.
- Edge helper tests live in the Deno harness (below); web-side no duplication.

**Edge harness (`supabase/functions/_shared/tests/ai-chat-helpers.test.ts`, Deno)**
- `resolveAiChatPlatformName`: each allowlisted id → its name; unknown string / non-string / empty / `' fcai-asnu '` (whitespace) → core `"Masar X"`.
- `buildSystemInstruction`: default → contains `"Masar X platform"` (byte-equal to today's prefix); explicit name → substitution; language instruction + data rule unchanged.
- Drift guard: the harness imports `packages/shared/src/branding/faculties.ts` (dependency-free, Deno-safe) and asserts `AI_CHAT_FACULTY_PLATFORMS` keys === `FACULTY_PRESET_IDS` — if Deno cannot resolve the import in the harness, fall back to duplicating the id list in the test with a loud comment (decided at implementation; the shared-side JSON test pins the ids regardless).

**E2E**: no new e2e (system prompts are not user-visible surface); existing chat/streaming specs run as regression in the worktree.

## 5. Atomic execution plan

| # | Commit | Contents | Gates (08-precommit.md) |
|---|---|---|---|
| 1 | `docs(specs): spec 055 — tenant-dynamic ZANE brand strings` | `specs/055-brand-string-sweep/{spec.md,tasks.md}` | — |
| 2 | `feat(shared): promptPlatformName faculty key + ai context.facultyId` | faculty.json (ar/en), types.ts contract, JSON shape test | shared vitest + tsc |
| 3 | `feat(web): tenant-dynamic prompt brand in ZANE web prompts` | prompt-brand.ts, assistant.ts builder, route.ts buildSystemPrompt, web tests | web vitest + tsc + eslint |
| 4 | `feat(ai-chat): allowlisted facultyId → platform name in system instruction` | pure.ts helpers, index.ts wiring, proxy injection, deno + proxy tests | deno test + web vitest + tsc |
| 5 | `chore(web): genericize sw template push-notification fallbacks` | sw.template.js | web vitest + tsc + eslint |
| 6 | PR `feat(brand): tenant-dynamic brand strings in ZANE prompts (spec 055)` | all above + e2e regression run | full gate suite + relevant e2e |

Ledger: `docs/specs/ledger` row (or the established ledger file) gains the spec-055 row in the final PR commit, per house convention.
