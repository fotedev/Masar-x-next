# Feature Specification: Multi-Platform Expansion (Desktop + Mobile)

**Feature Branch**: `004-multi-platform-expansion`
**Created**: 2026-08-17
**Status**: Draft
**Input**: User description: "Expand Masar X to native desktop and mobile apps. Wrap the existing Next.js 16 / React 19 web app in an Electron-based desktop shell, build a new Expo React Native mobile app for iOS and Android, and reorganize the codebase into a monorepo so the existing Supabase backend, i18n translations, AI Edge Functions, and shared types are reused across all three surfaces. Source: `sandbox/expo+electron.txt`."

## Summary

Masar X is currently delivered exclusively as a web application. The goal of this feature is to make the same product available as:

1. A **native desktop application** for Windows, macOS, and Linux.
2. A **native mobile application** for iOS and Android.

Both new surfaces must reuse the existing backend (Supabase Auth, Postgres, Storage, Edge Functions) and share source artifacts (notably i18n translation files) with the web app, so that improvements made in one platform are reflected across all platforms. A monorepo layout is required to make this sharing practical and sustainable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use Masar X as a Desktop App (Priority: P1)

A student who prefers studying on their laptop wants the Masar X experience without keeping a browser tab open. They download and install a desktop application, sign in with the same account they use on the web, and the full Masar X experience (subjects, summaries, AI assistant, quizzes, videos, profile, language switching) is available offline-installable with the responsiveness of a native window.

**Why this priority**: This is the lowest-effort, highest-leverage expansion because the existing Next.js app is already production-ready. It validates the multi-platform strategy before the larger mobile investment and immediately benefits users on slower networks or unstable browsers.

**Independent Test**: Install the desktop build, sign in, navigate to all main pages, upload a PDF, send a message to the AI assistant, switch language, and verify the experience is visually and functionally equivalent to the web app.

**Acceptance Scenarios**:

1. **Given** a user has installed the Masar X desktop app on Windows, macOS, or Linux, **When** they launch the app, **Then** the Masar X home page loads without first opening a browser
2. **Given** a user signs in on the desktop app, **When** they later visit the web app in a browser on the same machine, **Then** they are still signed in (shared Supabase Auth session)
3. **Given** a user uploads a PDF study summary via the desktop app, **When** the upload completes, **Then** the same file is visible in their account on the web app and (once Story 2 is delivered) on the mobile app
4. **Given** a user is on a slow or intermittent connection, **When** they reopen the desktop app, **Then** previously visited pages render from local cache where possible and show a clear offline state where not

---

### User Story 2 - Use Masar X as a Mobile App (Priority: P1)

A student who learns on the go wants Masar X in their pocket. They install the app from the App Store (iOS) or Play Store (Android), sign in once, and access the same subjects, AI tutor, summaries, and quizzes from their phone with a touch-optimized layout that supports both Arabic (RTL) and English (LTR).

**Why this priority**: Mobile is the dominant learning surface for the target audience. Without a mobile app, Masar X is effectively absent from where most users actually study.

**Independent Test**: Install the mobile build on a real iOS device and a real Android device, sign in, complete a quiz, send a message to the AI assistant, upload a PDF, switch language, and verify the experience is native-feeling and that the data matches the web app.

**Acceptance Scenarios**:

1. **Given** a user installs the mobile app on iOS or Android, **When** they open it for the first time, **Then** they see the Masar X branding and a sign-in flow, not a generic browser screen
2. **Given** a signed-in user is on a mobile device, **When** they rotate the device or switch system language, **Then** the app layout direction (LTR/RTL) and language follow the device settings
3. **Given** a user sends a message to the AI assistant on mobile, **When** the response includes math equations, **Then** the equations are rendered legibly and not as raw LaTeX source
4. **Given** a user taps "Upload PDF" on mobile, **When** the OS file picker opens, **Then** the user can pick a PDF from their device storage and the upload succeeds with the same limits and security as on the web
5. **Given** a user is offline on mobile, **When** they open the app, **Then** previously loaded content (cached lessons, last AI conversation) is still readable and the app shows a clear offline indicator

---

### User Story 3 - Translations Stay in Sync Across All Platforms (Priority: P2)

The Masar X maintainer adds a new translation key (for example, a new button label) in one place. After saving, the change is automatically reflected in the web app, the desktop app, and the mobile app without manual copy-paste or duplicate edits.

**Why this priority**: Without a shared source of truth, every translation update becomes a three-place change and will inevitably drift. This is the foundation that makes the multi-platform investment sustainable.

**Independent Test**: Add a new translation key in the shared messages file, run the build for all three apps, and verify the new string appears everywhere with the correct value in both Arabic and English.

**Acceptance Scenarios**:

1. **Given** a maintainer edits a translation in the shared messages file, **When** the web, desktop, and mobile apps are rebuilt, **Then** all three display the new string without further code changes
2. **Given** the same shared messages file is used, **When** a user switches language on any platform, **Then** the change is honored using the same key names and plural rules across all three

---

### User Story 4 - One Supabase Account Works Everywhere (Priority: P2)

A user who creates their account on the web can sign in on the desktop app and the mobile app using the same email and password (or Google sign-in) and sees the same profile, subscription, learning history, and uploaded files. A user who resets their password receives the reset email and the new password works on all platforms.

**Why this priority**: This is the security and trust contract that makes the multi-platform product feel like one product. Without it, users will perceive three separate services and lose confidence.

**Independent Test**: Create an account on the web, sign in on desktop and mobile with the same credentials, upload a file on mobile, and verify it appears on web and desktop. Reset the password and verify the new password works on all three.

**Acceptance Scenarios**:

1. **Given** a user has a Masar X account, **When** they sign in on the desktop or mobile app, **Then** they use the same credentials as the web app
2. **Given** a user resets their password, **When** they choose a new password, **Then** the new password works on web, desktop, and mobile
3. **Given** a user has uploaded study summaries on the web, **When** they open the same account on mobile or desktop, **Then** those summaries are visible and downloadable

---

### User Story 5 - Sensitive Backend Keys Never Leak into Client Builds (Priority: P1)

A security-conscious maintainer or external auditor inspects the desktop and mobile application bundles and verifies that no service-role keys, database admin credentials, or other server-only secrets are present. The mobile app continues to work correctly because it uses the public, anonymous key combined with Row Level Security (RLS) on the database.

**Why this priority**: A leaked service-role key on a mobile or desktop build is a critical, irreversible security incident. This must be a hard requirement from day one, not a hardening pass.

**Independent Test**: Inspect the production build artifacts for desktop and mobile (binary strings, env files, sourcemaps) and confirm only the public anon key is present. Verify in the database that RLS is enabled on every user-data table.

**Acceptance Scenarios**:

1. **Given** the desktop or mobile build is shipped, **When** an auditor scans the bundle for known secret patterns, **Then** no service-role key, database admin URL, or signing secret is found
2. **Given** a user attempts to read or write data through the mobile or desktop app, **When** the request is evaluated by the database, **Then** the operation is allowed or denied based on Row Level Security policies, not on client-side checks alone

---

### User Story 6 - Performance Meets the Multi-Platform Promise (Priority: P3)

After the desktop and mobile apps are in users' hands, real-world performance matches the expectations set during planning: the desktop app feels noticeably faster than the browser tab, and the mobile app feels noticeably smoother and more data-efficient than loading the web app on a phone browser.

**Why this priority**: This is the validation that the engineering investment paid off. It is P3 because it can only be measured after Story 1 and Story 2 are delivered, but it is the reason the feature was requested.

**Independent Test**: Measure app start time, screen-to-screen navigation time, and average data usage per session on representative devices, and compare to the same flows on the web app in a browser.

**Acceptance Scenarios**:

1. **Given** a user launches the desktop app cold, **When** the home page becomes interactive, **Then** the time-to-interactive is measurably faster than the same home page loaded fresh in a browser
2. **Given** a user scrolls the subjects list on a mid-range Android phone, **When** they scroll continuously for 5 seconds, **Then** the visible frames remain smooth (no jank, no dropped frames) compared to the web app in a mobile browser
3. **Given** a user completes a typical 10-minute study session on mobile, **When** the session ends, **Then** the total data transferred is lower than the equivalent session in a mobile browser

### Edge Cases

- What happens when a user is signed in on the web app, then installs the desktop or mobile app — are they automatically signed in or do they need to sign in again? Default: a clean sign-in is required on each new device, but the user is offered a "remember this device" option.
- What happens when the device or desktop is offline and the user tries to send a message to the AI assistant? The message is queued locally and a clear "offline, will retry" indicator is shown.
- What happens when a mobile user has both Arabic and English system languages configured? Default: the app follows the device primary language, with an in-app override.
- What happens when a desktop user uses a very small window? The layout must not break; below a minimum width the app shows a "please resize" message or switches to a compact mode.
- What happens when the AI assistant returns a very long response on mobile? Default: the chat scrolls naturally and the user can scroll back up; the response is streamed (not blocking the UI thread), and if it exceeds a sensible length the user sees a "show more" affordance instead of an unbounded layout.
- What happens if a maintainer forgets to update the shared messages file and adds a key only in the web app? The other platforms fall back to the key string itself (or a configured fallback) and log a warning in dev mode.
- What happens if Supabase is temporarily unreachable on first launch of a new install? The user sees a clear "cannot reach Masar X right now" screen with a retry button, not a blank page or a crash.
- What happens when a desktop auto-update downloads successfully but fails to apply on the next launch? The app reverts to the previous working version, logs the failure for the maintainer, and shows a non-blocking banner to the user explaining that the update was skipped.
- What happens when a user signs in to the web app using one provider (for example, Google) and then opens the desktop or mobile app for the first time? The first sign-in on the new device is treated as a separate sign-in event; the user is not silently auto-signed-in, but their existing account is found and reused once they authenticate with any supported provider whose email matches.

## Requirements *(mandatory)*

### Functional Requirements

**Desktop App**

- **FR-001**: The product MUST be distributable as an installable desktop application for Windows, macOS, and Linux, where the resulting installer does not trigger OS security warnings (Gatekeeper on macOS, SmartScreen on Windows) on the target platform.
- **FR-002**: The desktop app MUST launch the Masar X experience as a standalone window, not as a browser tab, and MUST support standard window controls (minimize, maximize, close).
- **FR-003**: The desktop app MUST reuse the existing Next.js web build as its primary surface, so that visual and functional parity with the web app is the default.
- **FR-004**: The desktop app MUST persist user session state locally so that re-opening the app does not require re-authentication within a reasonable session lifetime, and MUST offer a clear "sign out" action.
- **FR-005**: The desktop app MUST be able to update itself in place, and MUST revert to the previously working version automatically if an update fails to apply, so the user is never left with a broken app after an update.

**Mobile App**

- **FR-006**: The product MUST be distributable as an installable mobile application for iOS and Android, via the official app stores and/or as a signed build for direct installation.
- **FR-007**: The mobile app MUST provide touch-optimized navigation for subjects, summaries, quizzes, videos, the AI assistant, the user profile, and language settings.
- **FR-008**: The mobile app MUST support both LTR and RTL layouts and MUST honor the user's chosen language (Arabic or English), with RTL active when the language is Arabic.
- **FR-009**: The mobile app MUST allow the user to pick a PDF from device storage and upload it through the same backend upload path used by the web app, subject to the same size limits and authentication requirements.
- **FR-010**: The mobile app MUST render AI assistant responses, including math equations, legibly — equations MUST appear as formatted math, not as raw LaTeX source.
- **FR-011**: The mobile app MUST show a clear offline state when network is unavailable and MUST allow previously loaded content to remain readable.
- **FR-012**: The mobile app MUST allow the user to invoke the native OS share sheet for shareable study content (for example, a study card or summary), so content can be sent to other apps the user has installed.

**Cross-Platform (Web, Desktop, Mobile)**

- **FR-013**: Translations (Arabic and English) MUST live in a single shared source of truth and MUST be consumed by all three platforms, so that adding or editing a key in one place updates all three after rebuild.
- **FR-014**: User authentication MUST work end-to-end across web, desktop, and mobile using the existing Supabase Auth, with the same email/password and Google sign-in flows.
- **FR-015**: The same Supabase project (database, storage, edge functions) MUST serve all three platforms; no parallel or shadow backend is introduced.
- **FR-016**: The codebase MUST be organized as a monorepo with at minimum: a web/desktop app, a mobile app, and a shared package for translations and types.

**Security and Privacy**

- **FR-017**: Server-only secrets (service role key, database admin URL, signing secrets) MUST NOT be present in any client-side build (web, desktop, or mobile); the check that enforces this MUST be automated (run automatically before each release) rather than relying on manual review alone.
- **FR-018**: All user-data tables exposed to the desktop or mobile app MUST be protected by Row Level Security policies; no client-side authorization checks may be the only line of defense.
- **FR-019**: The mobile and desktop apps MUST apply the existing rate limits (password reset, edge functions) without weakening them and MUST handle rate-limit responses with user-friendly messaging.
- **FR-020**: AI provider credentials (for the AI assistant feature) MUST never be reachable from client code or any client-distributed bundle, on any platform (web, desktop, mobile).

**Repository and Build**

- **FR-021**: Adding a new translation key or type in the shared package MUST require no more than one edit and one build per platform.
- **FR-022**: The monorepo MUST build and run the web app, the desktop app, and the mobile app independently, so that a failure in one app does not block development of the others.
- **FR-023**: Documented developer setup steps MUST exist for: running the web app, building the desktop app, building the mobile app, and consuming the shared package.

### Key Entities

- **Platform Surface**: One of `web`, `desktop`, or `mobile`. Each surface is a deployable artifact that consumes the same backend and shared packages. Each has its own build pipeline and distribution channel.
- **Shared Translation Bundle**: A versioned package containing translation keys and values for all supported languages. Consumed by all three surfaces at build time.
- **Shared Type Package**: A versioned package containing TypeScript types for API contracts, database shapes, and cross-platform interfaces. Consumed by all three surfaces at build time.
- **User Session**: The authenticated identity shared across all three surfaces via Supabase Auth. Persisted locally per surface so re-launches do not require re-authentication within the session lifetime.
- **Bundled Application**: The shipped artifact for desktop or mobile. Subject to a security scan that verifies only public keys are present.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The desktop application installs and launches successfully on at least one current major version of Windows, macOS, and Linux.
- **SC-002**: The mobile application installs and launches successfully on at least one current major version of iOS and at least one current major version of Android.
- **SC-003**: A user who creates an account on the web can sign in on the desktop app and the mobile app with the same credentials, see the same profile data, and access the same uploaded files.
- **SC-004**: Adding a new translation key in the shared source results in the new string appearing on web, desktop, and mobile after a single edit and a rebuild of each surface — no copy-paste between platforms.
- **SC-005**: An automated security scan of the production desktop bundle and the production mobile bundle, run as part of the release pipeline, finds zero occurrences of the service-role key, database admin URL, AI provider keys, or any other server-only secret.
- **SC-006**: All user-data tables exposed to the desktop and mobile apps have Row Level Security enabled, verified by a database-level check.
- **SC-007**: On a mid-range Android device, scrolling the subjects list for 5 consecutive seconds produces no visible jank (frame drops are imperceptible to the user), compared to the equivalent scroll in a mobile browser where jank is visible.
- **SC-008**: A typical 10-minute study session on mobile uses less data than the equivalent session in a mobile browser, measured at the network layer.
- **SC-009**: Cold-launch time-to-interactive of the desktop app is at least as fast as loading the same home page in a fresh browser tab on the same machine.
- **SC-010**: 90% of a representative group of pilot users complete the sign-in flow on first attempt on both desktop and mobile, without assistance.
- **SC-011**: The desktop and mobile apps each reach their intended distribution channel (a downloadable installer for the desktop platforms, the App Store for iOS, the Play Store for Android) and pass the store/platform review on the first attempt.
- **SC-012**: A clean clone of the repository, on a CI runner with a documented reference hardware profile (and a populated package-registry cache, but no project-local cache), builds and runs the web app, the desktop app, and the mobile app end-to-end in under 30 minutes.

## Assumptions

- The existing Next.js 16 + React 19 + Supabase + Drizzle ORM stack on the web is the source of truth for behavior, design, and data. The desktop and mobile apps do not introduce a parallel feature set; they re-deliver the same product on new surfaces.
- The Supabase project URL and the public anon key are the only credentials required in the desktop and mobile builds. The service role key remains server-side only.
- The existing Supabase Auth email/password and Google sign-in flows are sufficient for desktop and mobile; no platform-specific identity provider is required for v1.
- Translation files currently located at `src/messages/` (Arabic and English JSON) move into the shared package; the web app continues to consume them through the package, not through a copied path.
- TypeScript is the shared language for types across web, desktop, and mobile.
- A monorepo tool (for example, pnpm workspaces or Turborepo) is acceptable and aligned with the team's existing toolchain preferences. The exact tool is a planning concern, not a spec concern.
- The App Store and Google Play review processes are accepted as a release constraint; signing and notarization requirements are addressed in planning.
- Offline behavior is a "read what you already loaded" guarantee, not a "full offline study" guarantee. Full offline support is out of scope for this feature.
- Mobile app distribution via official stores is the default for production; direct distribution (for example, an enterprise build) is out of scope unless explicitly requested.
- The desktop and mobile apps do not need to be feature-identical to the web at the moment of v1 release — they MUST cover the main user journeys (sign in, browse subjects, read summary, send AI message, upload PDF, switch language) but small feature gaps (for example, an admin-only page) are acceptable and tracked in the plan.
- The web app remains the primary development surface during this feature's implementation; the web app's behavior does not regress as a side effect of the monorepo reorganization.
- The same rate-limit policies applied to the web app's password reset and Edge Functions apply unchanged to the desktop and mobile clients.
- The mobile app's build size budget is consistent with a learning app (under ~80 MB installed) and is tracked in the plan, not in this spec.

## Explicitly Out of Scope (deferred from broader brainstorm)

The following capabilities were considered during scoping and are deliberately **not** part of this feature. They are listed here so a future spec can pick them up cleanly without relitigating the decision.

- **Spaced-repetition system (SRS) and associated push notifications.** The current product does not include an SRS, and adding one is a separate product decision that should ship as its own feature with its own UX research. Reminder notifications are deferred with it.
- **Apple Sign-In as a sign-in provider.** See the assumption on identity providers — email/password and Google are sufficient for v1. Apple Sign-In is mentioned here only as a possible future addition, not a current requirement.
- **Custom URL protocol (`masarx://`) for deep links from external sources.** No concrete trigger flow (magic-link email, push-notification deep link, share link) is in the current product scope. This is a small feature that can be added later when a real trigger exists; specifying it now would be speculative surface area.
- **Tablet-specific layouts (iPad split view, Android large-screen).** Phone form factor is the v1 target. Tablet polish is a follow-up.
- **Parallel backends (a separate Firebase, mobile-only database, or a forked API).** See FR-015.
