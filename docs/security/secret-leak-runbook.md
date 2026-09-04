# Secret Leak Runbook

**Spec**: 004-multi-platform-expansion, Task T056 (US5).
**Scope**: what to do when a Masar X credential is exposed - committed to git, shipped in a client bundle, pasted publicly, or found in a third-party dump.
**Related**: [SECURITY.md](../../SECURITY.md) (reporting policy) - `.gitleaks.toml` (scanner config) - `.github/workflows/ci.yml` (`gitleaks-artifacts`, `ai-endpoint-grep` jobs).

> Golden rule: **contain (Step 1) always comes before forensics (Step 3+).**
> Rotating a key makes every leaked copy worthless; purging git history only
> removes the evidence. Speed beats elegance - rotate first, investigate second.

## 0. Key inventory and rotation points

| Key | Legit location | Rotate / revoke at | Blast radius if leaked |
| --- | --- | --- | --- |
| Supabase **service-role** key | Server-only env (Vercel, local `.env.local`); never `NEXT_PUBLIC_*` | Supabase Dashboard - Project Settings - API: issue the replacement, then revoke the legacy/secret key | Total: bypasses RLS - full DB read/write + auth admin |
| Supabase **JWT secret** | Supabase auth internals (never in the repo) | Supabase Dashboard - Settings - API - JWT Settings: rotate. Invalidates ALL sessions; announce the forced re-login | Session forgery if leaked |
| Supabase **anon** key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public by design) | Same dashboard page as service-role | Limited by RLS; still rotate when RLS gaps are suspected or it was paired with a leaked JWT secret |
| AI provider keys (OpenAI / Anthropic / Gemini) | Supabase Edge Function secrets (e.g. `supabase secrets set GEMINI_API_KEY=...`), never in client code | Provider console: revoke + create, then update the Edge Function secret and redeploy the function | Billing abuse, prompt access within the provider project |
| Cloudinary **API secret** | Server-only env | Cloudinary Console - Settings - Security: rotate API secret | Asset upload/overwrite and library listing |
| Cloudinary **unsigned upload preset** | `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (public by design) | Cloudinary Console: restrict the preset (folder, allowed formats, max size) or recreate it | Spam uploads within the preset's limits |
| Brevo (SMTP/API) key | Server-only env (transactional email) | Brevo dashboard - SMTP & API: regenerate; update Vercel env vars | Phishing/spam sent from the domain; sender reputation damage |

## 1. Triage (first 15 minutes)

1. Identify which key(s) leaked and where (commit sha, artifact, URL, dump).
2. Open an incident channel and start a timestamped timeline log (who / what / when).
3. Assign one owner for rotation and one for evidence collection. Do not edit history or re-run CI before Step 2 containment is under way.

## 2. Contain - revoke and rotate

1. For each leaked key from the table above: **create the replacement first, then revoke the old one** (avoids an outage window for legitimate traffic).
2. Update every runtime that consumes the key:
   - Vercel project env vars (web), then redeploy;
   - Supabase Edge Function secrets for AI provider keys (`supabase secrets set ...`), then redeploy the function;
   - GitHub Actions secrets/variables, if the key is used in CI.
3. Client-bundle keys (`NEXT_PUBLIC_*`): rotation requires a **web rebuild + redeploy** AND a **desktop release** (the installer embeds the Next build) - track it through `docs/releases/TEMPLATE.md`.
4. If a **service-role key** leaked, treat every table as potentially exposed: start the Step 5 review immediately and consider a maintenance window if exfiltration looks plausible.
5. Verify containment: the old key returns 401/403 on a canary call, the new key works in staging. Record exact rotation timestamps in the incident log.

## 3. Gitleaks re-scan

1. Full git-history scan (git mode covers every commit):
   `gitleaks detect --source . --config .gitleaks.toml --redact`
2. Built-artifact scan, mirroring the CI `gitleaks-artifacts` job (run after a fresh `pnpm --filter web build`):
   `gitleaks detect --no-git --source . --config .gitleaks.toml --redact`
   Note: artifact dirs (`dist/`, `build/`, `out/`, `.next/`) are deliberately NOT allowlisted - spec 004 T015.
3. Record every finding (path, rule, commit) in the incident log even if the key was already rotated - this is the input for Step 4.

## 4. Git history purge decision

**Decide first** - purge only makes sense when ALL of these hold:
- the key is already revoked (purge is hygiene, not containment);
- the repo (or the branch with the secret) is or was public, and the finding is in history that matters;
- push-freeze coordination with all collaborators is realistic (small team, few forks).

If the repo is public, assume the key was harvested within minutes: rotation (Step 2) is the only real fix.

Purge procedure (when elected):
1. Announce a **push freeze** (pin an issue, ping the team channel).
2. Take a full backup: `git clone --mirror <url> masarx-backup.git`.
3. In a **fresh clone**, create a replacements file (`leaked-value==>***REMOVED***`, one pair per line) and run:
   `git filter-repo --replace-text replacements.txt --force`
   (install: `pip install git-filter-repo`; BFG is an alternative).
4. Force-push every branch and tag: `git push --force --all` and `git push --force --tags`.
5. Coordinate: every collaborator must **re-clone** (never pull/rebase onto the old history); open PRs need rebasing onto the rewritten branches.
6. Ask GitHub Support to clear cached views / dangling commits; note that **forks and pre-existing local clones keep the old history forever**.
7. Re-run the Step 3 history scan on the rewritten repo and record the result.

## 5. Rate-limit / exposure-window review

Window of interest: from key creation (or last rotation) to detection.
1. Supabase: Auth logs, API gateway logs, DB logs for the window - look for mass reads (service-role bypasses RLS), auth-admin calls, unknown usage patterns. Review `audit_logs` / `system_logs` where present.
2. Web AI proxy: `/api/ai-chat` rate-limit records - request counts per user/IP vs the configured limits; flag accounts above baseline; reset abused quotas.
3. Provider dashboards (OpenAI / Anthropic / Gemini): usage and billing anomalies. Cloudinary: storage/bandwidth spikes, unknown assets. Brevo: sent-mail volume, bounces, complaints.
4. If DB access was possible, force-expire password-reset tokens and consider a global session invalidation (JWT secret rotation does this automatically).
5. Tighten the failing limit(s) (proxy rate limiter, Supabase auth rate limits, provider spend caps) and record observed peak rates in the log.

## 6. User-data impact assessment

1. Enumerate what the leaked credential could reach:
   - service-role: every table, every row (RLS bypass), auth admin API;
   - anon: only what RLS policies allow (policies live in `supabase/migrations`, e.g. `006_system_and_security`, `008_jwt_role_sync`);
   - AI keys: prompts/requests through the provider project, spend;
   - Cloudinary secret: media library read/overwrite;
   - Brevo: contact lists + send capability (phishing risk to users).
2. Query affected tables/logs for reads/writes inside the exposure window; list affected users and data classes (PII, auth identities, content).
3. Decide on user notification per SECURITY.md and applicable obligations; prepare the notice **before** any public disclosure.

## 7. Disclosure checklist

- [ ] All leaked keys rotated; old keys verified dead (canary 401/403).
- [ ] Runtime envs updated and redeploys live (web, Edge Functions, desktop if `NEXT_PUBLIC_*` rotated).
- [ ] gitleaks history + artifact re-scans green; findings logged.
- [ ] History-purge decision recorded (yes/no + reason); force-push coordination completed if elected.
- [ ] Exposure-window review done; rate limits tightened where abuse was seen.
- [ ] User-data impact documented; users notified if PII/auth data was reachable.
- [ ] Private GitHub Security Advisory opened; public disclosure timed with the fix release.
- [ ] Release notes updated (Known issues / security section) per `docs/releases/TEMPLATE.md`.
- [ ] Post-incident review: how the key leaked (committed env file, CI blind spot, human error) and which guard closes that path (new gitleaks rule, ESLint rule, CI job, pre-commit hook).
- [ ] This runbook updated with anything the incident taught.