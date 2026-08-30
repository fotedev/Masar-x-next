# Masar X Android wrapper (Capacitor)

A native Android shell around the production Masar X web app.

- **Loads:** https://masarx.vercel.app (Capacitor `server.url` — remote session)
- **Package:** `com.masarx.app`
- **App name:** Masar X
- **Icons/splash:** generated from the production PWA icon (`/logo_EN.webp`) by `generate-icons.mjs`
- **Permissions:** `INTERNET` only
- **Auth:** the web app uses Supabase email + password sign-in, which works inside the WebView

## Layout

| Path | Purpose |
| --- | --- |
| `capacitor.config.json` | App id, name, remote URL, background color |
| `www/index.html` | Bundled offline fallback page (Arabic, auto-retries into the app) |
| `android/` | Generated Capacitor Android project (committed for reproducible CI builds) |
| `generate-icons.mjs` | Regenerates launcher icons + splash from `assets-src-logo.webp` |

## Rebuilding the APK

1. Open **Actions → Build Android APK → Run workflow** on the `apk-build` branch.
2. Set `versionName` / `versionCode` (versionCode must be **higher** than any installed build).
3. Download artifacts:
   - `masarx-apk` — the signed release APK
   - `masarx-signing` — upload keystore (`masarx-upload.jks`), its password (`.keystore-password`), the SHA-256 cert fingerprint (`sha256.txt`), and a ready-made `assetlinks.json`

**Keep the keystore.** Every future APK must be signed with the same keystore or Android will refuse to update the installed app. To make CI reuse it, store two repository secrets:

- `MASARX_KEYSTORE_B64` — `base64 -w0 masarx-upload.jks`
- `MASARX_KEYSTORE_PASSWORD` — the password from `.keystore-password`

## Local edits

- Version numbers live in `android/app/build.gradle` (`versionCode`, `versionName`) and are overridden by the workflow inputs at build time.
- App name / strings: `android/app/src/main/res/values/strings.xml`.
- Icons: replace `assets-src-logo.webp`, run `node generate-icons.mjs` (needs `npm ci` first).
- The wrapper config in `capacitor.config.json` is copied into the APK at build time (`android/app/src/main/assets/capacitor.config.json` mirrors it).
