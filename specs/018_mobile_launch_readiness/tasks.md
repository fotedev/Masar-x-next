# Spec 018 — Tasks

Execution ledger. Every task: verify with the gates in spec.md §5 before
marking ✅. Parallel-session rule (memory): re-check `git log` before each
commit; stage only own paths.

## C1 — Spec landing
- [ ] T062 `specs/018_mobile_launch_readiness/{spec.md,tasks.md}` committed.

## C2 — Dependency repair (G1, G2)
- [x] T063 `@react-navigation/native-stack` → `^6.11.0` in `apps/mobile/package.json`; `pnpm install` updates root lockfile. **T063b (correction):** `@types/react` downgrade attempted and REVERTED — dual-copy conflict with the hoisted workspace v19 copy breaks `tsc`; kept `^19.2.14` (see spec G2 correction).
- [ ] T064 `pnpm -r --if-present typecheck` green (incl. mobile).

## C3 — Scripts + dev client (G4)
- [x] T065 mobile `lint` script → `eslint .`; added `eslint` + `typescript-eslint` (parser) devDeps matching web/desktop; config header updated; violations: none.
- [x] T066 mobile `export` script (`expo export --platform android`) + root `build:mobile` → `pnpm --filter mobile export`; export exits 0 (2.73 MB hbc). **Root cause found en route:** `"type": "module"` in `apps/mobile/package.json` broke the whole Expo toolchain (metro.config.js / babel.config.js / index.js are CJS; `expo start` had tolerated it, export did not) — flag removed; metro.config.js restored to CJS with an explanatory note. First successful bundle ever for this app.
- [x] T067 add `expo-dev-client ~4.0.29` (SDK 51 line) as dependency.

## C4 — AI bearer token (G5, T054a)
- [ ] T068 `packages/shared/src/ai`: additive `authToken?: string` option on `aiRequest`/`sendAiMessage`/`streamAiMessage`; header only when set.
- [ ] T069 `apps/mobile/src/lib/ai.ts`: pass Supabase session `access_token` per call; update gap comments + T054a ledger to resolved.
- [ ] T070 unit tests: header attached / header absent; web suite still green.

## C5 — Store assets (G3, G7)
- [ ] T071 generate `assets/icon.png` (1024), `assets/adaptive-icon.png`, `assets/splash.png` from brand knot mark (fallback path: placeholders + owner task, note in ledger).
- [ ] T072 `app.json`: icon/splash/adaptiveIcon keys + brand colors; version → `0.6.0` (both `app.json` and `package.json`).

## C6 — Tests + CI (G6)
- [ ] T073 mobile vitest: `secure-store-text` chunking, `read-cache` TTL (mocked AsyncStorage).
- [ ] T074 ci.yml `mobile` job: install → typecheck → lint → test → export (placeholder `EXPO_PUBLIC_*`); actionlint clean.

## C7 — Launch ledger
- [ ] T075 `apps/mobile/README.md` spec-018 section: fixed-gaps ledger with evidence + owner checklist (`eas init`, Expo token, EAS secrets, production builds per platform, store listing assets, submit).

## Owner actions (post-merge, not blocking this spec)
- [ ] `eas init` → `projectId` into `eas.json`; repo secret `EXPO_TOKEN` if CI builds are wanted.
- [ ] EAS secrets for `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] `eas build --profile production -p android` (AAB) and `-p ios` (IPA) on a macOS-capable EAS worker (cloud-side).
- [ ] Google Play Console / App Store Connect accounts, listings, screenshots, privacy policy → submit.
- [ ] Device smoke: login → subjects → summaries → quiz → AI chat (bearer fix) → language switch on a real device.
