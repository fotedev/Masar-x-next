# Wave 8 — Desktop & infra (agents 22–24)

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful.

## Agent 22 — Electron main process

**1. SEV: Critical — Duplicate `ipcMain.handle` registrations crash every Electron boot**
- LOC: `apps/desktop/src/main/index.ts:377` and `:390` duplicate `:353` (`app:openExternal`) and `:366` (`auth:rendererReady`)
- MECHANISM: Electron throws `TypeError: Attempted to register a second handler for '…'` on a second handle() for the same channel. The throw rejects `startMainProcess` → auto-start catch (index.ts:472-476) → `app.quit()`.
- SCENARIO: Every packaged/dev launch: window paints, loadURL fires, then app quits. Handlers at 410-447 (window controls, updates) never register.
- TRACE: :353 handle OK → :366 handle OK → :377 throw → promise rejection → :473 catch → app.quit().
- FIX: delete the duplicated blocks (377-395). / CONF high / STATUS NEW. Tests never catch it: `ipcMain.handle` is a plain vi.fn() (main.test.ts:53) that doesn't throw. — **[FIXED in PR #155, incl. the mock contract]**

**2. SEV: High — `will-navigate` origin check bypassable via URL userinfo**
- LOC: `apps/desktop/src/main/index.ts:327-332`
- MECHANISM: `navUrl.startsWith(allowedOrigin)` — `http://127.0.0.1:<port>@evil.com/` parses with host evil.com (prefix consumed as userinfo) and passes the prefix test.
- SCENARIO: XSS or crafted `target="_self"` link navigates the shell to an attacker origin; the preload bridge is re-injected on navigation, so the attacker page gets `masarxDesktop` — window controls, openExternal, updates:installAndRestart, and any buffered OAuth deep link via `auth:rendererReady` (index.ts:366-371 returns the pending code=…).
- TRACE: will-navigate (328) prefix match passes → navigation proceeds → preload re-runs on new origin → bridge exposed.
- FIX: `new URL(navUrl).origin === allowedOrigin` instead of startsWith. / CONF high / STATUS NEW

**3. SEV: Medium — `updates:skip` is a silent no-op** (`updater.ts:241-246` calls `auAny.skipUpdateCallback?.(...)` — field doesn't exist in electron-updater 6.8.9 → optional chaining skips; UpdateToast.tsx:62 "skip" does nothing, toast re-appears, auto-download continues; test passes only because the mock supplies the field). FIX: persisted version filter. CONF high / STATUS NEW

**4. SEV: Medium — Recovery-page Retry can never recover** (`index.ts:64` Retry = window.location.reload() on the data: recovery page, never the loopback URL; no main-side re-issue after recovery shown; did-finish-load resets retry counter :295-297 — slow Windows boot exceeding 500ms probe + 3×500ms retries → permanent error page until manual relaunch). FIX: Retry invokes IPC → win.loadURL(loopback). CONF high / STATUS NEW

**5. SEV: Medium — `did-fail-load` ignores `isMainFrame`; subframe failures burn the retry budget** (`index.ts:252-293` — any subframe/resource failure increments didFailLoadAttempts → whole-window reloads → recovery page after 3). FIX: `if (!isMainFrame) return;`. CONF high/medium / STATUS NEW

**6. SEV: Low — OAuth authorization code written to log file** (`index.ts:242` logs full masarx://auth/callback?code=… to userData/logs/main.log — local-only, single-use PKCE, limited impact). FIX: strip query. CONF high / STATUS NEW

**7. SEV: Low — macOS lifecycle: no `activate` handler; destroyed-window IPC** (`index.ts:459-463`; window:* handlers close over win, would throw after close on macOS). CONF high (code), low impact (Windows-primary) / STATUS NEW

**8. SEV: Low — TDZ ReferenceError in `stopChild` kill race** (`server.ts:170-198` — child.kill throw → catch calls onExit() which clears `const killer` before initialization → stop() rejects → app.quit() in .finally never runs; narrow race). CONF medium / STATUS NEW

**9. SEV: Low — port TOCTOU lets a local process hijack the shell's origin** (`port.ts:8-13`, `server.ts:63-107` — listener closed before child binds; attacker HTML gets full preload bridge; documented as accepted in port.ts itself). CONF medium / STATUS KNOWN-active (documented in code)

**10. SEV: Low — no `setPermissionCheckHandler`** (only setPermissionRequestHandler at index.ts:337-340; sync checks fall back to Chromium defaults). Hardening gap. CONF high / STATUS NEW

**Clean**: preload surface (no Node primitives leaked, minimal typed channels); bridge contract matches byte-for-byte; deep-link pipeline (shape gate, renderer re-validation, cold-start buffer, second-instance routing — ordering correct); updater trial/rollback marker ordering converges; no file-serving/fs-from-IPC; window.open handler denies correctly.

---

## Agent 23 — Desktop web shell

**1. SEV: High — DocumentReader load-watchdog fires unconditionally, breaking every embedded document after 8s**
- LOC: `apps/web/src/components/desktop/workspace/DocumentReader.tsx:45-54`
- MECHANISM: the 8s watchdog timer set in the effect is only cleared by dep change — there is NO `onLoad` handler anywhere (verified: only onError at :137), so at t+8s setLoadFailed(true) runs even after a successful load; iframe replaced by error state; retry remounts + re-arms → infinite error loop.
- SCENARIO: any desktop user opens a lecture document → renders fine → 8s later swaps to "Could not load the document" → retry → fails again 8s later.
- TRACE: workspace → DocumentReader mounts → effect schedules 8000ms → no onLoad to cancel → setLoadFailed → :104 error UI → handleRetry (:56) → cycle.
- FIX: add onLoad={() => setLoadFailed(false)} + loadedRef check in watchdog. / CONF high / STATUS NEW (introduced by audit-fix commit d0a90a0 — the added comment says "if onLoad hasn't fired" but the handler was never written)

**2. SEV: Medium — Assistant panel stays keyboard-focusable/AT-visible when width-collapsed** (`StudyWorkspace.tsx:78,198-213` + `AssistantPanel.tsx:125` — at <1024px wrapper gets w-0 overflow-hidden but `inert={!open}` uses assistantOpen which stays true → invisible panel steals Tab focus). FIX: inert={!assistantVisible}. CONF high / STATUS NEW

**3. SEV: Low — PWAInstallPrompt "Later" permanently kills the prompt** (`PWAInstallPrompt.tsx:76-83` — X and "Later" both set localStorage with no TTL + Chromium one-shot beforeinstallprompt → never re-prompted; listener attaches post-hydration so early-fired event missed). FIX: per-version/TTL dismissal key. CONF high (mechanism), medium (impact) / STATUS NEW

**4. SEV: Low — github-releases YAML fallback guesses a version-suffixed portable filename that can't exist** (`github-releases.ts:174` vs `electron-builder.yml:205` — builder artifactName has no ${version} → fallback URL 404s on API rate-limit). FIX: drop version from guess. CONF medium-high / STATUS NEW

**5. SEV: Low — Toolbar assistant state desync when panel width-collapsed** (`StudyWorkspace.tsx:180` vs `:78` — button reads "open"/aria-pressed=true while panel hidden). CONF high / STATUS NEW

**6. SEV: Low — Hardcoded English "(coming soon)" suffix** (`ReaderToolbar.tsx:79` — I3; rest of desktop namespaces have full ar/en parity, verified). CONF high / STATUS NEW

**7. SEV: Low — Blanket context-menu suppression kills right-click paste in text inputs** (`DesktopShellGate.tsx:53-56` — capture-phase preventDefault on all contextmenu, no replacement menu; keyboard paste still works; may be intended FR-016). CONF high (mechanism) / STATUS NEW

**Clean**: CustomTitlebar window controls (null-safe, race-free, verified against main+preload); UpdateToast renderer logic; bridge detection (preload before page JS, no handshake race, no web false-positives); desktop-shell.css scoping; downloads page error handling; window.open routed to system browser; Layout desktop chrome gating hydration-consistent; i18n parity green across all five desktop namespaces.

---

## Agent 24 — PWA/build/config

**1. SEV: Medium — SW offline fallback is dead code: navigations never cached, offline users get a raw error**
- LOC: `apps/web/public/sw.template.js:75-82` (same in generated sw.js), `:121`
- MECHANISM: navigate branch does fetch(request).catch(() → caches.match(request) || caches.match("/")) but nothing ever writes navigation responses into the cache (no c.put in bucket 1), and "/" is never cached either → both lookups can never hit.
- SCENARIO: user offline opens app → fetch fails → both cache lookups miss → browser error page. The "offline" half of the PWA never works.
- FIX: cache successful navigations (SWR) or precache a dedicated /offline page. / CONF high / STATUS NEW

**2. SEV: Low — Unbounded runtime cache between deploys** (`sw.template.js:106-125`, `:85-103` — every successful GET stored, no entry/size cap; only purge is versioned activate cleanup; browser quota eviction the only bound). FIX: periodic trim or exclude /_next/image. CONF high / STATUS NEW

**3. SEV: Low — `push` handler crashes on non-JSON payload** (`sw.template.js:198-199` — event.data.json() unguarded → unhandled rejection, no notification). FIX: try/catch + generic fallback. CONF high / STATUS NEW

**4. SEV: Low — Conflicting duplicate X-Frame-Options (SAMEORIGIN vs DENY)** (`next.config.mjs:198` vs root `vercel.json` headers[0] + web vercel.json — both emitted; RFC 7034 multiple-value behavior undefined). FIX: delete XFO block from vercel.json, keep one value. CONF medium / STATUS NEW

**5. SEV: Low — Image optimizer allowlist broader than needed** (`next.config.mjs:60-64` — res.cloudinary.com with no path constraint; multi-tenant subdomain proxiable via /_next/image). FIX: pathname pattern. CONF high / STATUS NEW

**6. SEV: Low — Workflow hygiene notes** (all 4 workflows injection-clean, least-privilege; BUT `fallow.yml:63` fallow-rs/fallow@v3 and `lighthouse.yml:118` treosh/lighthouse-ci-action@v12 pinned to mutable tags not SHAs; `release.yml:78-80` cancel-in-progress can abort mid-upload publish leaving partial draft). CONF high / STATUS NEW

**7. SEV: Low — I5 doc drift: `pnpm.neverBuiltDependencies` does not exist in root package.json** (actual mechanism = `onlyBuiltDependencies` allowlist in pnpm-workspace.yaml, intact; AGENTS.md:18 + 03-invariants.md:9 stale pointers; already item 10 in .zcode/plans). CONF high / STATUS KNOWN-active

**Verified clean (actively refuted the classic findings)**: SW update flow healthy end-to-end — sw.js gitignored + generated by prebuild with VERCEL_GIT_COMMIT_SHA; pnpm 9.15.4 lifecycle probe confirms scripts run; live prod shows CACHE_NAME "masarx-5627f0c" with no-cache no-store; skipWaiting + clients.claim + old-cache purge; navigation network-first so auth-critical HTML never stale. ci.yml clean. tsconfigs strict:true where consumed (tsconfig.app.json/node.json are unreferenced orphans). vercel.json /assets immutable rule is dead config (no such dir). sw.js ≡ sw.template.js apart from CACHE_NAME.
