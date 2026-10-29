# Wave 10 — Quality & security (agents 28–30)

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful.

## Agent 28 — Test validity

**1. SEV: Critical — Quiz grading + score persistence: client-authoritative and 0% tested**
- LOC: `apps/web/src/hooks/useQuizPlayerRuntime.ts:200` (`isCorrect = Number(selectedOption) === Number(q.correct_answer)`), `QuizPlayer.tsx:74` (score = filter of client-saved answers), mobile mirror `QuizPlayScreen.tsx:172`
- MECHANISM: web/mobile quiz tests (`quiz.test.ts:162-191`, `quiz-service.test.ts:113-135`) only assert payload pass-through — the test supplies is_correct:true and asserts the mock received it. No test file for useQuizPlayerRuntime or QuizPlayer; coverage: quiz.ts 77.6%/47.8% branch, grading hook 0%.
- SCENARIO: grading regression ships green; the DB stores whatever the client computed (finishAttempt(score)) — forged client sets any score; no server recomputation, no test even locking the client-trust contract.
- FIX: extract grading into a pure tested function; add RPC/RLS-side score recompute; test it. / CONF high / STATUS NEW — **[superseded by audit C4; FIXED via spec 030 (PRs #161/#162)]**

**2. SEV: High — Rate-limit durable backends (Upstash/Supabase) untested; tests exercise only the code prod doesn't run** (`rate-limit.ts:145-331` vs test header "in-memory backend is the decision layer"; 38.95% stmts — prod selects durable paths that no test executes; fail-open reconciliation invisible). FIX: stub fetch, test mergeRemoteCount/pipeline/demote. CONF high / NEW

**3. SEV: High — Redemption flow untested; RPC exists only in archived migrations** (`useRedeemAccessCode.ts:10` rpc('trw_redeem_access_code'); defined only at migrations.old/20260222033000:149; zero tests; coverage marks cstat-no). FIX: re-home RPC in active migration + tests. CONF medium / NEW

**4. SEV: High — Entire API-route layer + auth guard untested (0% coverage)** (`api-auth.ts:14-40`; api/ai/chat, ai-chat, auth/sync, health/db, mcp all 0% per coverage report — the only server-side enforcement of AI rate limiting and the 401/429 contract). FIX: route-level tests. CONF medium-high / NEW

**5. SEV: High — Middleware/proxy (CSP nonce, session refresh) 0% coverage** (`proxy.ts` 160 stmts 0% — CSP/nonce or cookie-refresh regression ships green; route-mocked e2e won't trip a broken-but-non-throwing CSP). CONF medium / NEW

**6. SEV: Medium — study-flow e2e soft-skips its entire data path in data-less CI** (`study-flow.spec.ts:43-49` poll → catch → test.skip — subjects/RLS regression auto-skips the meaningful steps). FIX: route-mock. CONF high / NEW

**7. SEV: Medium — TRW member/non-member content delivery untested beyond the client gate** (trw pages 0%; `trw-gate.spec.ts:33-35` only asserts redirect/no-crash; gate component tested but page-level data gating not). FIX: non-member e2e asserting zero gated rows in DOM. CONF medium / NEW

**8. SEV: Low — Chain-shape assertions pass while queries are invalid** (`useTRW.test.tsx:51` String(or!.args[0])).toContain — malformed .or() passes; same class as the known PGRST-400 guest bug unit tests missed). CONF medium / NEW

**9. SEV: Low — Known-red paste test parked as skip** (`paste-attachments.test.ts:41` it.skip — transposition defect enforced nowhere). CONF high / NEW

**Clean**: desktop deepLink/logging/server tests are genuine contract tests (real EventEmitters, scripted fake child, negative cases); shared service-role-guard/schemas/i18n; web ai-stream-consume (mid-codepoint UTF-8 split), abort-race, postgrestError; mobile pure-logic suites; AuthContext state-transition tests — all real behavioral tests. No snapshot-only tests; no un-awaited assertions; all vitest include globs cover existing files (mobile RN screens documented non-goal); prod-smoke opt-in by env.

---

## Agent 29 — Security sweep

**1. SEV: High — TRW/non-academic gate bypass: client-side-only "enable" guard on `profiles.show_extra_assets`**
- LOC: `apps/web/src/app/[locale]/profile/page.tsx:225-240` (guard), `lib/supabase/proxy.ts:66-86` (gate fallback), `migrations/002_core_identity.sql:35-37` (policy), `migrations.old/20260221032100_enforce_extra_assets_cooldown.sql` (only trigger)
- MECHANISM: handleToggleExtraAssets blocks enabled===true in JS only, then unconditionally writes profiles.update({show_extra_assets}); applied UPDATE policy is `USING (auth.uid() = id)` with no column restriction; no applied migration requires a redeemed code — only a 2h cooldown trigger (first false→true flip passes immediately, updated_at NULL). proxy.ts grants /non-academic via the profiles fallback whenever app_metadata.show_extra_assets is absent.
- SCENARIO: any authenticated user PATCHes own profile via PostgREST with {"show_extra_assets": true} → immediately unlocks ALL TRW routes; the hardened secret access code (010) is bypassed entirely.
- TRACE: proxy.ts hasExtraAssets = app_metadata (false) → select show_extra_assets from profiles → attacker-set true → no redirect. The React guard executes client-side only.
- FIX: server-side trigger/rule requiring a consumed verify_system_access_code row (or move entitlement to trw_memberships/app_metadata only); drop the profiles fallback in proxy.ts. / CONF high / STATUS NEW — **[FIXED in PR #155: extra_assets_entitled column + guard trigger + redeem_system_access_code RPC; proxy.ts profiles fallback remains as transition-period read — now safe since writes are server-gated]**

**2. SEV: Medium — Stored XSS sink in news file_url href** (`news/page.tsx:357,366-372` — href={item.file_url} unvalidated; combined with logged news FOR ALL USING(true) write policy, an inserted `javascript:` row yields click-to-execute JS for every visitor — NEW sink location converting the known news RLS issue into user-visible XSS). FIX: https-only at render AND write. CONF high / STATUS NEW sink

**3. SEV: Medium — upload-file edge: no rate limit + user-controlled Cloudinary folder** (`upload-file/index.ts:15-27` no limiter anywhere; `:87` folder from request body → `:186` formData — authenticated users can POST 50MB files repeatedly with zero throttling and place uploads into ANY org Cloudinary folder (news/, avatars/); only public_id namespaced). FIX: per-user rate limit + fixed folder whitelist. CONF high / STATUS NEW

**4. SEV: Low — Unthrottled authenticated metric counter spam** (`api/metrics/event/route.ts:28-47` — auth+schema-gated but no rate limit/dedup; script-loop {"type":"download"} with 500-char attacker strings inflates dashboards; corroborates Wave-6 F4 active_ping). CONF high / NEW

**5. SEV: Low — verify_system_access_code brute-forceable by authenticated users** (`010:87-119` — revoked from anon but no per-user rate limit, non-constant-time compare; distinguishable 'invalid'; impact bounded: codes atomically consumed, grant cosmetic show_extra_assets). FIX: check_rate_limit wrap. CONF high / NEW — **[the new redeem_system_access_code RPC (PR #155) wraps check_rate_limit best-effort]**

**6. SEV: Low — X-Powered-By exposed** (next.config.mjs no poweredByHeader key; default true). FIX: poweredByHeader:false. CONF high / NEW

**7. SEV: Low (info) — Upstash credentials file on disk** (`redis.env.txt` repo root, live URL/token; gitignored, never committed — local hygiene only). CONF high / NEW (no repo exposure)

**8. SEV: Low — upload-file 500 path leaks internals** (`upload-file/index.ts:~300` details/type from generic catch — same class as logged leakage). KNOWN-active (new instance)

**Clean**: all 4 dangerouslySetInnerHTML sinks are static CSS/JSON-LD/server-literals; every target=_blank carries rel=noopener; summary YouTube iframe sanitizer builds fixed-prefix same-host embed; SSRF: no other caller-URL fetches; cloudinary-webhook verifies x-cld-signature over raw bytes before parsing; edge CORS fixed allow-list no credentials; Electron hardened (contextIsolation, nodeIntegration:false, webSecurity, sandbox); /api/admin/metrics admins-row check; no hardcoded key patterns (sk-/AIza/ghp/AKIA), no eval/Function, no productionBrowserSourceMaps, no serverActions.allowedOrigins overrides, no .env committed; CSP absent on /api only because matcher excludes it (JSON-only responses inherit XFO/nosniff/Referrer-Policy). syncUserProfile copies only full_name/avatar_url — finding 1 independent of it.

---

## Agent 30 — UI logic + interaction

**1. SEV: High — FileDropzone duplicate id breaks click-to-pick on multi-dropzone forms**
- LOC: `apps/web/src/components/FileDropzone.tsx:28,111,119` — default inputId "file-upload-input"; label htmlFor overrides nested-input association → every label resolves to the FIRST #file-upload-input in the document.
- SCENARIO: `news-form/NewsMediaUploads.tsx:71,:119` render PDF + images dropzones simultaneously, neither passes id → clicking the images zone opens the PDF input's picker → picked image fails the .pdf/.doc check → image never attaches (drag-drop still works, masking it). Latent at AttachmentSection.tsx:74, edit-summary/page.tsx:414, AdminProfileImage.tsx:99.
- FIX: unique default id via useId(). / CONF high / NEW

**2. SEV: High — MobileNav drawer loses focus to body; no trap despite aria-modal**
- LOC: `components/Header.tsx:413-417` + `header/MobileNav.tsx:123-131`
- MECHANISM: opening the menu sets the hamburger (focused element) invisible → visibility:hidden removes it from focus order → focus falls to body; drawer declares role="dialog" aria-modal="true" but moves no focus in and traps nothing; Tab walks background content. Escape/backdrop/X DO restore focus via cleanup (Header.tsx:103).
- FIX: focus the drawer's close button on open; trap Tab within the drawer. / CONF high / NEW

**3. SEV: Medium — SecretAccessGate input anchored to document, not viewport** (`header/SecretAccessGate.tsx:90` — Fragment sibling of header, no positioned ancestor → absolute top-16 anchors to document origin and scrolls; gate input invisible on scrolled pages; works only at scrollTop≈0). FIX: fixed or render inside fixed header. CONF high / NEW

**4. SEV: Medium — Sign-out from mobile drawer leaves the drawer open** (`Header.tsx:264-271` + `MobileNav.tsx:312-319` — handleSignOut never setIsMobileMenuOpen(false); only handleNavigate closes; browser back/forward too → home with stale drawer + body scroll locked). CONF high / NEW

**5. SEV: Medium — Public-facing modal pattern: no Escape, no scroll lock, no focus management** (AddCourseModal.tsx:92-96, AddNewsModal.tsx:67, AppealFormModal.tsx:90, EditSummaryModal.tsx:53, ManageLecturesModal.tsx:55, AddSubjectModal.tsx:37 — inline fixed overlays, zero keyboard dismiss, zero body scroll lock, no initial focus/containment; Escape only in ProofImageModal:12-23, backdrop-click only in AddSubjectModal:43; z-indexes inconsistent z-50/z-[100]/z-[110]). FIX: one shared modal primitive. CONF high / NEW

**6. SEV: Low — Hidden-tab notifications silently dropped when SW controller null** (`NotificationProvider.tsx:103-110` — optional-chained postMessage, no fallback; corroborates Wave-9 #4). CONF medium / NEW

**7. SEV: Low — Footer heart invisible in light mode (hardcoded white)** (`Footer.tsx:45` text-white fill-white on bg-white). CONF high / NEW

**8. SEV: Low — Desktop-app banner flashes for users who dismissed it** (`DesktopAppBannerClient.tsx:30-49` — isDismissed starts false, localStorage read in mount effect → visible flash each navigation). CONF high / NEW

**9. SEV: Low — ui/Tabs has no tab semantics or arrow-key nav** (`ui/Tabs.tsx:81-98,108-127` — plain buttons, no tablist/tab/panel, no roving tabindex; functional but non-idiomatic). CONF high / NEW

**Clean**: DesktopNav/UserMenu; Footer links + WaitlistSignup; AcademicOnboardingGate redirect guard (stale-closure safe); ThemeToggle/LanguageToggle hydration; ThemeContext toggle; PageTransition reduced-motion; home sections; QuizPlayer orchestration; PreloadKatex; FileDropzone drag handlers; admin FilterBottomSheet (has trap+scroll lock+Escape — the pattern public modals lack); DesktopShellGate/UpdateToast; no NEW backdrop-filter containing-block reintroductions.
