# Desktop Launch Readiness — Owner-Action Register

**Created:** 2026-09-23 (spec 014) · **Desktop version at writing:** 0.6.0 (pre-tag) · **Pipeline:** tag `v0.6.0` → `release.yml` → GitHub Releases

The desktop app is engineering-ready: Electron 44.4.5 (current line, exact-pinned), no native modules, working `masarx://` deep-link login flow, auto-updater, spec 005 closed. The items below are the **remaining actions only the owner can execute** — each is a click/purchase, not code.

---

## 1. Enable Google login in the desktop shell (⚠️ do before telling students)

The shell's Google sign-in redirects through `masarx://auth/callback` (PKCE deep link, spec 014). Until the allow-list entry exists, clicking "Google" in the shell opens the browser and ends on Supabase's redirect-error page; **email/password sign-in works regardless**.

**Action:** Supabase Dashboard → your project → **Authentication → URL Configuration → Redirect URLs** → add:

```
masarx://auth/callback
```

That is the only change. Google Cloud Console needs nothing (Supabase orchestrates the Google side and its own HTTPS redirect). Verify after adding: desktop app → Login → Google → consent in system browser → browser hands off via `masarx://` → the app window focuses and the session lands (PKCE code exchanged in the renderer).

## 2. Authenticode code signing (SmartScreen)

The installer is **unsigned** → Windows SmartScreen shows "Windows protected your PC" for the first downloads. This is cosmetic-but-scary; students can click "More info → Run anyway", but expect support noise.

**Action:**
1. Purchase an **OV or EV code-signing certificate** (EV: instant SmartScreen reputation; OV: reputation builds over downloads). Any CA (Sectigo, DigiCert, Certum…).
2. Export as `.pfx` (EV tokens: use the CA's token software with electron-builder's Windows signing support).
3. Set repo secrets `CSC_LINK` (base64 of the .pfx or URL) and `CSC_KEY_PASSWORD` — the `win.certificateFile`/`publisherName` block in `apps/desktop/electron-builder.yml` is already commented, shaped for `${env.CSC_LINK}`; uncomment and fill `publisherName` with the cert subject.
4. Nothing else — `release.yml` passes the environment through to electron-builder.

Until signed, the honest wording for students: *"Windows may show a security prompt because the app is new — choose 'More info' → 'Run anyway'."*

## 3. Already decided / by-design (no action, listed for completeness)

- **macOS/Linux targets** stay unbuilt: the pipeline is Windows-only, `entitlements.mac.plist` is deliberately absent, and the audit's G5.3 keeps those targets non-promised. Add sibling release jobs when there's demand.
- **Crash reporting / file logs** (audit R7, Medium): accepted for now; revisit post-launch with a lightweight solution (Sentry has an Electron SDK) — needs an owner account decision, hence out of spec 014.
- **Workspace content**: the study workspace renders whatever lectures the admin enters (dummy rows like `33222` seen in verification are upstream data, not code). Content entry is the standing owner task from the MVP launch ledger.

## 4. Release mechanics (v0.6.0)

Everything is committed and pushed except the tag. When ready:

```bash
git tag v0.6.0
git push origin v0.6.0
gh run watch --repo fotedev/Masar-x-next   # ~7-8 min, publishes NSIS + portable + latest.yml
```

`electron-updater` clients on v0.5.9 will pick up v0.6.0 automatically from `latest.yml`.
