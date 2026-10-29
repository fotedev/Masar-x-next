# Wave 7 — Mobile (agents 19–21)

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful. Note: H27's diagnosis below was later corrected — see the POST-AUDIT note on finding 1.

## Agent 19 — Mobile auth/profile

**1. SEV: Medium — No AppState-driven token refresh; expired token after long backgrounding causes up to ~30s of 401 errors on resume**
- LOC: `apps/mobile/src/lib/supabase.ts:70-74, 94-100`; no AppState auth listener anywhere (grep: AppState only in QuizPlayScreen for quiz timing)
- MECHANISM: auth-js 2.118 non-browser path (verified in node_modules) runs a plain 30s setInterval; RN pauses JS timers while backgrounded; factory sets `autoRefreshToken: true` with no foreground kick.
- SCENARIO: app backgrounded > access-token TTL → on resume, queries fired before the next interval tick use the dead token → 401s for ≤30s, then self-heals.
- FIX: AppState listener calling startAutoRefresh/stopAutoRefresh (Expo-documented pattern). / CONF medium / STATUS NEW

**2. SEV: Low — LocalAuthSession mirror is write-only: duplicate refresh+access tokens stored with zero readers** (`auth-storage.ts:41-53`; writers only AuthContext.tsx:107,109,143; no reader of `local_auth_session` — doubles credential surface, churns writes hourly). FIX: drop or consume the mirror. CONF high / STATUS NEW

**3. SEV: Low — Chunked SecureStore write writes header before chunks: crash mid-write silently destroys the stored session** (`secure-store-text.ts:55-62` header first; read guard :85 returns null on missing chunk → forced re-login despite valid backup chunks). FIX: chunks first, header last. CONF high (mechanism), low likelihood / STATUS NEW

**4. SEV: Low — signOut errors swallowed by Profile; on network failure server-side revocation silently doesn't happen** (`ProfileScreen.tsx:121` void catch; `AuthContext.tsx:139-144` — auth-js removes session locally even on non-40x server error, UI flips to Login with no signal). CONF high / STATUS NEW

**5. SEV: Low — Hardcoded English error string in LoginScreen (I3)** (`LoginScreen.tsx:78` "Enter your email and password."). CONF high / STATUS NEW

**6. SEV: Low — Unconfirmed-email login misreported as bad credentials** (`LoginScreen.tsx:88` — "email not confirmed" maps to invalidCredentials → user retries forever instead of checking inbox; no confirm-resend path on mobile). CONF high / STATUS NEW

**7. SEV: Low — uuid4 is Math.random-based; verified non-security use** (`uuid.ts:10-16`; sole consumer ai.ts:67 conversationId — no PKCE/session use). No fix required; polyfill if reused for auth. CONF high / STATUS NEW

**8. SEV: Low — Client-only validation gaps (server-enforced)** (`signup-validation.ts:22-31, 48-52` — no email-format check; PASSWORD_MIN_LENGTH=6 client mirror; gaps cause confusing generic errors, not bypasses). CONF high / STATUS NEW

**Clean**: SecureStore chunking with WHEN_UNLOCKED_THIS_DEVICE_ONLY, no plaintext fallback; factory blocks service-role keys; App.tsx auth gate closed-union status (no null-vs-undefined dead guard); profile academic save RLS-scoped; no deep-link/PKCE flow (OAuth deferred); AuthContext lifecycle sound; sentry.ts public DSN only.

---

## Agent 20 — Mobile study flow

**1. SEV: Medium — Review post "succeeds but reports failure" → duplicate reviews**
- LOC: `apps/mobile/src/screens/SummaryDetailScreen.tsx:90-100,131-141`
- MECHANISM: onSubmitReview awaits insertReview (succeeds) then `await refreshAll()` (:134) with no try/catch — if the refetch throws, outer catch shows postFailed though review inserted; form already cleared → resubmit → duplicate (no unique constraint on reviews, 005:31-53). Same pattern onDeleteReview (:151-158).
- FIX: catch refreshAll separately so mutation success never reports failure. / CONF high / STATUS NEW — screen currently unreachable (see #9), impact latent

**2. SEV: Medium — useSupabaseQuery serves previous cacheKey's data while loading the new one**
- LOC: `apps/mobile/src/hooks/useSupabaseQuery.ts:49-75`
- MECHANISM: on cacheKey change, `data` never cleared; cacheGet async; loading raised only on cache miss. Until new fetch resolves, screen renders previous key's payload.
- SCENARIO: academic path change level 1→3 → old level-1 subject list stays on screen until fetch returns (or forever on failure).
- FIX: setData(null) (or key-mismatch guard) at the top of the effect. / CONF high / STATUS NEW

**3. SEV: Medium — Academic-profile fetch failure silently degrades to level 1/semester 1 and poisons the cache** (`useAcademicProfile.ts:45-49` + `SubjectsScreen.tsx:60-62,84` — transient offline error → profile null → defaults → level-1 subjects fetched AND CACHED for a level-3 user; offline view shows wrong catalog). FIX: don't run subjects query until profile load resolved; surface error state. CONF high / STATUS NEW

**4. SEV: Medium — Guest subjects parity divergence vs web (show_on_home), plus stale is_academic chain** (`SubjectsScreen.tsx:69-76` + `academic.ts:65-67` vs web `useSubjects.ts:15-17,84-86` — web guests get show_on_home filter, mobile doesn't; mobile chains is_academic filter web dropped post-TRW decoupling). CONF high (divergence; intent may be deliberate) / STATUS NEW

**5. SEV: Medium — MathText hard height clamp clips long summary content** (`MathText.tsx:106` Math.min(...,900), :125 container, WebView scrollEnabled={false} — summaries taller than ~900px permanently clipped; failed/height state never resets on text change). FIX: remove cap or enable scrolling. CONF high / STATUS NEW

**6. SEV: Low — cacheClearAll is dead code; documented sign-out hygiene never runs** (`read-cache.ts:88-98`; AuthContext.tsx:139-143 clears auth only; chat-history.ts:8 comment claims otherwise — cached subjects/news/quizzes survive account switches, bounded to 3 fixed keys). CONF high / STATUS NEW

**7. SEV: Low — Corrupt cache timestamp served as fresh (isStale inverted for invalid savedAt)** (`read-cache.ts:71-73` — unparseable savedAt → isStale false; nobody consumes isStale, so TTL is advisory-only). FIX: invert logic. CONF high / STATUS NEW

**8. SEV: Low — SubjectDetail resolves subject by display name; duplicates break the screen + raw PostgREST errors leak to UI** (`SubjectsScreen.tsx:96` passes item.name; `SubjectDetailScreen.tsx:110` .eq("name").single() throws PGRST116 on duplicates; raw error rendered :262). CONF medium / STATUS NEW

**9. SEV: Low — SummaryDetailScreen + entire reviews flow unreachable on mobile** (no navigate("SummaryDetail") anywhere; SubjectDetail opens PDFs via Linking :334) — KNOWN-active follow-on of the deliberate Summaries-tab removal; bugs #1/#5 activate when re-wired. CONF high

**10. SEV: Low — Offline + no cache leaves loading spinner stuck** (`useSupabaseQuery.ts:67-70`; same in QuizAttempts/Quizzes/News empty states). CONF high / STATUS NEW

**Clean**: lecture-content.ts faithful web port (id-first match, correct precedence); review rating bounds mirror DB CHECK; i18n keys all exist both locales; nav params all match RootStackParamList; duplicate-review parity (neither platform enforces one-per-user).

---

## Agent 21 — Mobile quiz/news/AI/shell

**1. SEV: High — Signed-in quiz finish failure: result silently lost on-device, UI falsely claims it was saved**
- LOC: `apps/mobile/src/screens/QuizPlayScreen.tsx:195-208` (guest-only save), `:210-211` (catch), `:300-303` (message); `lib/quiz.ts:190` (saveGuestResult only called in guest branch)
- MECHANISM: `finish()` gates persistence on `if (user)` → server path. On any server error the catch sets savedToServer=false but never falls back to saveGuestResult; the finished screen renders `quiz.savingOffline` ("saved on this device only"). `finishingRef` (L156, never reset) blocks any re-finish.
- SCENARIO: signed-in user completes timed quiz offline → startAttempt throws → score screen claims device-saved but nothing written anywhere; restart discards; server attempt left open (finished_at null).
- TRACE: finish() L177 if(user) → L178 startAttempt throws → L210 catch {savedToServer=false} → L213 setResult → L303 renders savingOffline with no saveGuestResult call.
- FIX: signed-in failure path falls back to saveGuestResult (or pending-sync queue); reset finishingRef for retry. / CONF high / STATUS NEW
- **[POST-AUDIT ROOT-CAUSE CORRECTION (2026-10-28): the DEEPER cause of mobile quiz finishes failing on prod was DB-level — prod `quiz_attempts` lacked `updated_at` while its own trigger assigned it (every UPDATE → 42703) and lacked `status` (mobile's old finish wrote it). Mobile finishes could never persist server-side regardless of network. Fixed via PR #162; the client-side fallback recommendation remains valid.]**

**2. SEV: Medium — Mobile chat history is one global key: cross-account/guest conversation bleed on auth transitions**
- LOC: `apps/mobile/src/lib/chat-history.ts:19` (`masarx_ai_chat_cs_assistant`, unscoped), `AIAssistantScreen.tsx:98-109` (loads every mount)
- MECHANISM: single AsyncStorage key shared by guests and all accounts; auth flip remounts the screen which reloads whatever the last identity left. Not wiped (web's guest-wipe bug absent) but a different bug: no user scoping.
- SCENARIO: user A signs out, user B signs in → B sees A's full conversation (and vice versa with guests). Web scopes per-user/mode.
- FIX: scope key per identity. / CONF high / STATUS NEW (different from the fixed web bug)

**3. SEV: Medium — QuizAttempts review race: stale fetch overwrites the expanded attempt's review** (`QuizAttemptsScreen.tsx:150` single review state; :175-195 toggleExpand unguarded async fetch — tap A (slow) then B (fast) → B expanded but shows A's questions; answers mapped by question_id from B → wrong/unsolved rendering). FIX: capture attempt.id, discard stale response. CONF high / STATUS NEW

**4. SEV: Low — Offline with empty cache = infinite spinner instead of offline/error state** (`useSupabaseQuery.ts:67-71`). CONF high / STATUS NEW

**5. SEV: Low — I18n/Theme hydration not gated: Arabic flash for English users each cold start** (`I18nContext.tsx:47-60` default "ar", async resolveLocale; `App.tsx:148-237` never checks `resolving` — exposed but consumed by nothing; same in ThemeContext.tsx:42-53). CONF high / STATUS NEW

**6. SEV: Low — Guest attempt review requires network; Sentry boundary doesn't cover the provider stack** (`QuizAttemptsScreen.tsx:183-185` server fetch even for isLocal attempts; `App.tsx:239-253` + `index.js:16-18` — SentryBoundary mounted inside Theme/Auth/I18n providers, provider render errors escape with no fallback). CONF medium / STATUS NEW

**7. SEV: Low — Copy claims queued delivery/undercounted resumed-attempt time (informational)** (`offline.aiQueued` shown for failed sends though no queue exists, i18n.ts:189 → AIAssistantScreen.tsx:172,291; resumed-attempt time from this session's attemptStartRef — matches web, parity-only). CONF high/medium / STATUS NEW

**Clean**: guest quiz requests mobile-clean (QuizPlayScreen.tsx:177 gates all server writes on if(user)); quiz timer robust (wall-clock endTimeRef + AppState re-check + finishingRef single-fire); AI abort/streaming fine for non-streaming path; paste-attachments parity holds; news-filter matches web; network hook safe; navigation standard pattern.
