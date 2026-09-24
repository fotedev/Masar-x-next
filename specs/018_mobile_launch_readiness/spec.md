# Spec 018 — Mobile App Launch Readiness

> Branch: `feat/018-mobile-launch-readiness` (off `main` @ `91a4b1a`).
> Status: **APPROVED** (plan-mode approval 2026-09-24; recommended defaults taken:
> store-ready scope, OAuth stays deferred, brand-derived icon/splash).
> MVP Lock category: **(4) deployment readiness** (AGENTS.md I12).

## 1. Context & problem statement

`apps/mobile` is a feature-complete Expo SDK 51 app (email/password login,
Subjects / Summaries / Quizzes / AI Assistant / Profile tabs, offline
stale-while-revalidate cache, ar/en + RTL) that has **never been built for
stores** and is **currently broken** by a merged dependency bump:

| # | Gap | Impact |
|---|-----|--------|
| G1 | `@react-navigation/native-stack` `^7.19.2` (dependabot PR #32, merged 2026-09-21 as `e562e5e`) has peer deps `@react-navigation/native ^7.4` + `react-native-screens >=4`; the app pins `6.1.18` / `~3.31.1` | Version skew — runtime breakage risk / broken type contract |
| G2 | `@types/react ^19.2.14` against a React `18.2.0` runtime (SDK 51 pairs with React 18) | Type-level mismatch |
| G3 | No `assets/`, no `icon`/`splash`/`adaptiveIcon` image keys in `app.json` | Store submission impossible |
| G4 | Mobile `lint` script is a stale `echo` stub although `eslint.config.mjs` exists; `expo-dev-client` missing while `eas.json` development profile sets `developmentClient: true`; root `build:mobile` points at a `build` script mobile does not have | Dead automation, false confidence |
| G5 | AI chat 401s from mobile (tasks.md **T054a**): `supabase/functions/ai-chat` authenticates via `Authorization` bearer → `auth.getUser()`; web injects it in its Next proxy, the shared AI client never attaches it | Core feature dead on mobile |
| G6 | Zero tests in `apps/mobile`; no mobile CI beyond the cross-workspace typecheck | No regression gate |
| G7 | Version `0.5.6` lags the prepped desktop `0.6.0` release (`174539a`) | Release-train mismatch |

Deferred-by-design (NOT in scope, per README + spec 004): Google OAuth
deep-link login (US4/T046), push notifications, OTA updates (`expo-updates`),
AI streaming UI. Email/password remains the v1 auth path.

**Goal:** the repo can produce signed store-ready Android AAB / iOS IPA builds
via EAS with a one-command owner flow, with all blockers above fixed and
gated.

## 2. Architecture & design

All changes are additive or revert-shaped; no new runtime surfaces.

### 2.1 Dependency repair (G1, G2, G4) — `apps/mobile/package.json`
- `@react-navigation/native-stack`: `^7.19.2` → **`^6.11.0`** (revert of the
  dependabot skew; v6 is the family the app was built and verified against).
- `@types/react`: `^19.2.14` → **`~18.2.79`** (matches the React 18.2 runtime
  SDK 51 pairs with).
- Add `expo-dev-client` (`~4.0.x`, SDK 51 line) so the `development` EAS
  profile's `developmentClient: true` is real.
- Scripts: `lint` → `eslint .` (config exists); add `export` =
  `expo export --platform android` (headless bundle proof, also the target of
  root `build:mobile`); add `test` = `vitest run` (Phase 4).
- Root `package.json`: `build:mobile` → `pnpm --filter mobile export`.

### 2.2 AI bearer token (G5) — `packages/shared/src/ai` + `apps/mobile/src/lib/ai.ts`
- Shared client (`aiRequest`, `sendAiMessage`, `streamAiMessage`) grows an
  **additive optional** option `authToken?: string` (and accepts it per call).
  When present, requests carry `Authorization: Bearer <authToken>`. When
  absent, behavior is byte-identical to today (web callers unchanged; the web
  proxy keeps injecting auth server-side).
- `apps/mobile/src/lib/ai.ts`: before dispatching, read the session
  (`getSupabaseClient().auth.getSession()`) and pass `accessToken` as
  `authToken`. No token in any body; header only (ai-boundary contract
  unchanged).
- The in-file "known backend gap" comment on `apps/mobile/src/lib/ai.ts` and
  the T054a ledger entry are updated to "resolved in spec 018".

### 2.3 Store assets (G3, G7) — `apps/mobile/assets/` + `app.json`
- Generate from existing brand assets (knot mark per `docs/BRANDING.md` §7/§8;
  vector sources already in repo):
  - `assets/icon.png` — 1024×1024
  - `assets/adaptive-icon.png` — 1024×1024 foreground (safe-zone padded)
  - `assets/splash.png` — 1284×2778-class center-fit image on brand background
- `app.json`: `icon`, `splash` (image + `backgroundColor` + `resizeMode:
  contain`), `android.adaptiveIcon.{foregroundImage,backgroundColor}`,
  `android.edgeToEdgeEnabled` left as SDK 51 default. Colors from
  `docs/BRANDING.md` (current blue-500 family / `#1d4ed8` base stays unless
  brand doc says otherwise).
- Version bump `0.5.6` → **`0.6.0`** in `apps/mobile/package.json` +
  `app.json` (aligns with the desktop 0.6.0 release train, tag owner-held).
- If local SVG→PNG rendering proves infeasible on this machine, fall back to
  placeholder-color assets + an owner task — decided during execution, noted
  in the completion ledger.

### 2.4 Tests + CI (G6)
- `apps/mobile`: add `vitest` (+ `@types/node` as needed). Suite targets
  **pure logic only** (no RN environment required):
  1. `secure-store-text` chunking round-trip (>1600-char strings,
     multi-chunk remove, unicode safety).
  2. Shared AI client: `authToken` → `Authorization: Bearer …` header
     attached; absent → no header (fetch-mocked).
  3. `read-cache` TTL/expiry behavior (AsyncStorage mocked).
- `.github/workflows/ci.yml`: add a `mobile` job — `pnpm install`, mobile
  `typecheck`, `lint`, `test`, `export` with placeholder
  `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` values (export is config-missing-safe;
  the app degrades to its "unconfigured" screen by design).

### 2.5 Launch ledger (docs)
- `apps/mobile/README.md`: "Launch readiness (spec 018)" section — what is
  fixed, verification evidence, and the owner checklist:
  `eas init` (fills `projectId` in `eas.json`) → Expo access token → EAS
  secrets for `EXPO_PUBLIC_*` → `eas build --profile production -p android`
  and `-p ios` → store accounts/listings/screenshots/privacy policy → submit.

## 3. Behavior preservation & regression strategy

- Web + desktop untouched. The only shared-package change (§2.2) is an
  optional parameter — no existing call site changes behavior (proven by the
  new "no token → no header" unit test and the untouched web suite).
- Mobile runtime behavior: dependency revert restores the v6 navigation
  family the screens were written against; no screen code changes needed.
- CI stays green: `pnpm -r --if-present typecheck` now genuinely covers
  mobile; `pnpm -r --if-present test` picks up the new vitest suite.
- i18n untouched (no new user-facing strings; error paths reuse existing
  canned-message machinery).
- Secret hygiene: only the public anon key flows through mobile config
  (existing invariant FR-017); `ai-endpoint-grep` and `gitleaks` must stay
  green.

## 4. Test specification

| Suite | File | Scenarios |
|---|---|---|
| chunking | `apps/mobile/src/lib/__tests__/secure-store-text.test.ts` | short value single-chunk; >1600 chars multi-chunk round-trip; emoji/Arabic unicode; remove clears all chunks |
| ai bearer | `apps/mobile/src/lib/__tests__/ai.test.ts` (or `packages/shared` local) | `authToken` set → header `Bearer x`; absent → header undefined; URL override still applied |
| read-cache | `apps/mobile/src/lib/__tests__/read-cache.test.ts` | fresh hit; expired miss; TTL boundary |

Mobile `export` gate: `pnpm --filter mobile export` exits 0 and emits
`dist/` bundle (proof the Metro graph resolves incl. `masarx-shared`).

## 5. Atomic execution plan

| # | Commit | Contents | Gates |
|---|--------|----------|-------|
| C1 | `docs(specs): add specs/018 mobile launch readiness` | this spec + tasks.md | docs-lint |
| C2 | `fix(mobile): revert native-stack v7 skew + align react types` | §2.1 deps (`pnpm install` lockfile update incl.) | typecheck all workspaces |
| C3 | `chore(mobile): wire lint/export scripts, add expo-dev-client` | §2.1 scripts + root `build:mobile` + expo-dev-client | mobile lint + export green |
| C4 | `feat(shared): optional bearer token for AI client` + `feat(mobile): attach session token to AI calls` (may land as one commit) | §2.2 | mobile vitest (ai cases) + web suite untouched |
| C5 | `feat(mobile): brand icon/splash assets + version 0.6.0` | §2.3 | export re-run |
| C6 | `test(mobile): vitest pure-logic suite + CI mobile job` | §2.4 | full `pnpm test`, ci.yml actionlint |
| C7 | `docs(mobile): EAS launch checklist in README` | §2.5 | docs-lint |

Every commit: `pnpm -r --if-present typecheck`; only files under
`apps/mobile/`, `packages/shared/src/ai/`, root `package.json`,
`.github/workflows/ci.yml`, `specs/018_*`, `apps/mobile/README.md` are
staged — never the untracked spec-017 web files carried in the worktree.
