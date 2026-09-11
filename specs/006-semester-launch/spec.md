# Spec 006 — Semester Launch: Platform Engineering & Stabilization

**Status:** Approved (2026-09-10) — Phase 1 in execution
**Target Milestone:** Academic Semester Launch (20-Day Runway, semester start ≈ 2026-09-30)
**Primary Architecture:** Multi-Platform (Web Core/PWA, Expo Native, Capacitor Lite*, Electron Desktop)
**License:** MIT (already published — repo `fotedev/Masar-x-next` is **public**)

> Derived from the 2026-09 brainstorm transcript (`sandbox/brainstorm-chat.txt`) and reconciled
> against the actual monorepo on 2026-09-10. Every item carries a status:
>
> | Marker | Meaning |
> |---|---|
> | ✅ DONE | Already true in the repo — verified |
> | 🔨 PHASE 1 | In the current execution batch |
> | 📋 PHASE 2 | Next batch (mobile / Lite) |
> | 📦 PHASE 3 | Release window (Days 15–20) |
> | ⚠️ CORRECTED | Original spec text did not match repo reality — see note |
> | ❌ REJECTED | Product decision 2026-09-10 — do not implement |

---

## 1. System Architecture & Platform Matrix

```
                          ┌───────────────────────────┐
                          │  Backend & API Layer      │
                          │  (Next.js / Supabase DB)  │
                          └─────────────┬─────────────┘
                                        │ (Shared Endpoints & Auth)
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
┌─────────────────┐            ┌──────────────────┐           ┌──────────────────┐
│  Web Core & PWA │            │ Expo / RN Native │           │  Capacitor Lite  │
│   (Electron host│            │   (Primary App)  │           │ (Planned — no    │
│    today)       │            │                  │           │  code yet)       │
└─────────────────┘            └──────────────────┘           └──────────────────┘
```

⚠️ **CORRECTED vs original spec:**
- Desktop is **Electron only** (electron 32.2.0, pinned per invariant I6). No Tauri track.
- Mobile is **Expo SDK 51 + React Navigation v6** (NOT expo-router). 7 screens under
  `apps/mobile/src/screens/`. All route/navigation snippets below use React Navigation.
- **Masar X Lite (Capacitor)** has **no code in the repo** — kept as a deliberate track;
  see §2B and Phase 2.

| Dimension | Primary: **Masar X Native** (Expo) | Fallback: **Masar X Lite** (Capacitor — planned) | Desktop: **Masar X Desktop** (Electron) | Web / PWA |
| --- | --- | --- | --- | --- |
| **Engine** | React Native components | Android System WebView / WebKit | Chromium + Node runtime | Browser engine |
| **Target User** | Daily primary mobile experience | Low-spec devices, data-saver mode | Heavy study sessions on PC/Mac | Instant frictionless access |
| **Boot Time** | ~2.3s (measured on test device) | ~4.8s (WebView bootstrap, measured) | Wrapped Next.js load | Instant (ServiceWorker) |
| **RAM Profile** | ~125 MB (measured) | ~195 MB (measured) | Chromium host | ~80–120 MB |
| **Scroll / FPS** | 60–120 FPS via GPU | ~71% smoothness score (measured) | Native browser scroll | 60 FPS standard |
| **Release Flow** | Stores + OTA (Expo Updates) | Direct sync with Web build | Bundled NSIS/portable via GitHub Releases | Continuous deploy (Vercel) |

The boot/RAM/FPS figures come from the device comparison in the brainstorm transcript
(screenshots analyzed 2026-09); treat as directional, not benchmark-grade.

---

## 2. UI/UX Audit & Critical Bug Fixes

### A. Expo / React Native (Primary App) — 📋 PHASE 2

- **Touch Handling on Subject Cards:** ⚠️ **CONFIRMED VALID.**
  `apps/mobile/src/screens/SubjectsScreen.tsx` renders subjects as a `FlatList` of
  `<View style={styles.card}>` containers (Pressable is only used for a retry button).
  Cards are unresponsive to tap-as-button semantics.
  - *Fix:* Wrap card elements in `Pressable`/`TouchableOpacity` with visual feedback and
    navigate via **React Navigation** (`navigation.navigate(...)`), not `expo-router`.
  - ⚠️ Original spec's code sample used `expo-router` + `router.push('/(tabs)/...')` —
    **does not apply** to this repo. Corrected pattern:

  ```tsx
  import { Pressable, Text, View } from 'react-native';
  import { useNavigation } from '@react-navigation/native';

  export function SubjectCard({ subject }: { subject: Subject }) {
    const navigation = useNavigation<MainNavProp>();

    return (
      <Pressable
        onPress={() => navigation.navigate('SubjectDetails', { id: subject.id })}
        style={styles.card}
        android_ripple={{ color: '#0001' }}
        accessibilityRole="button"
        accessibilityLabel={subject.name}
      >
        {/* card content unchanged */}
      </Pressable>
    );
  }
  ```

- **Zain AI Chat Assistant Failures (mobile):** 📋 PHASE 2 — audit auth headers and
  non-browser streaming in `AIAssistantScreen`; reuse the retry/backoff/circuit-breaker
  patterns that already exist on web (`apps/web/src/lib/ai-assistant.ts`).
- **Empty States & Loaders (mobile):** 📋 PHASE 2 — add `ActivityIndicator`/skeletons and
  contextual empty-state actions on News/Summaries/Subjects screens.
  ⚠️ **Web side is already DONE** — `SubjectsGrid` skeleton cards, News spinner +
  translated strings, `SummariesSection` skeletons (verified 2026-09-10).

### B. Capacitor / Web (Masar X Lite) — Lite shell itself is 📋 PHASE 2

- **Desktop Download Banner Inside Mobile Wrappers:**
  - ✅ **DONE for Electron:** `DesktopAppBannerClient.tsx` returns `null` when
    `useIsDesktopRuntime()` (`apps/web/src/lib/desktop/useIsDesktopRuntime.ts`,
    probing `window.masarxDesktop` from the preload bridge) is true. Hydration-safe.
  - 📋 PHASE 2: extend the same hook pattern with a WebView/Capacitor check
    (`Capacitor.isNativePlatform()` once the Lite shell lands) so the Windows/macOS CTA
    never renders inside the Lite wrapper.
- **Double Header (site navbar + in-page back bar):** ⚠️ **CORRECTED** — observed on the
  **BIS fork** screenshots (old deployment), not verified in this repo. Re-audit after
  Lite lands; fix there first if present.
- **Card Truncation (2-column grid on phones):** 🔨 **PHASE 1 (web).**
  `apps/web/src/components/SubjectsGrid.tsx` currently starts at `grid-cols-2` on mobile
  with `line-clamp-2` titles. Fix: single column below `sm` (see tasks.md).

---

## 3. Branding, Copywriting & Localization Specs

- **Central Authority (`BRANDING.md`):** 🔨 **PHASE 1** — created at repo root in this
  batch. ⚠️ **CORRECTED:** it documents the **actual** tokens (CSS variables in
  `apps/web/src/index.css`: `--brand-navy 15,23,42`, `--brand-blue 59,130,246`,
  `--brand-sky 14,165,233`, `--brand-orange 245,158,11`, consumed via Tailwind
  `brand.*` utilities). The originally proposed `#2563EB` palette was **not adopted**.
  Assistant name: **زين** (ar) / **ZANE** (en) — per `ChatContainer.tsx` +
  `aiAssistant.json` (original spec's "Zain" anglicization corrected).
- **Purge Hardcoded & Debug Text:**
  - ⚠️ **CORRECTED:** `"This subject is taught by a female doctor..."` and lecture id
    `33222` are **BIS-fork database content**, not code in this repo (verified: not in
    `apps/web/src` or `packages/shared`). This repo instead has a legitimate
    `professorGender: male|female` i18n feature. Cleanup belongs to the BIS deployment
    (📦 PHASE 3, ops task on that DB).
  - 🔨 **PHASE 1:** hardcoded Arabic strings in `apps/web/src` (known offenders listed in
    tasks.md B1/B2) migrate to `packages/shared/src/messages/{ar,en}/*.json` per
    invariant I3.
- **TRW section:** ❌ **REJECTED for removal** (product decision 2026-09-10) — `trw` /
  `trwRedeem` are intentional features of the current platform, not BIS placeholder
  content. Keep.
- **RTL & Typography:**
  - Footer credit ordering bug **CONFIRMED & 🔨 PHASE 1**: `Footer.tsx` DOM order is
    `Aboalayoun → by → ♥ → Made with`, which visually reads **"Aboalayoun by ♥ Made
    with"** in the RTL locale. (⚠️ Original spec called it glyph inversion; it is a DOM
    ordering bug.) Fix preserves `bidi-ltr` isolation classes.

---

## 4. Multi-Tenancy & College Adaptation

⚠️ **CORRECTED:** the repo already ships `NEXT_PUBLIC_COLLEGE_NAME`
(default `جامعة مسار`) in `.env.example` — build on it, do not introduce a parallel
`NEXT_PUBLIC_APP_NAME`/`NEXT_PUBLIC_FACULTY_NAME` pair.

- 🔨 **PHASE 1:** add optional `NEXT_PUBLIC_SUPPORT_CHANNEL`; comment-mark an
  `AI_DAILY_FREE_LIMIT` as **planned / not yet read by code** (today's real limit is the
  server-side 10 req/min rate limit in `/api/ai/chat`).
- 📋 PHASE 2+: `tenant_id` / `campus_code` schema segmentation for future institutional
  instances. The BIS deployment currently runs as a **separate fork** — documented here so
  a proper multi-tenant path is chosen before the next college is onboarded.

---

## 5. Open Source & Repository Engineering

⚠️ **CORRECTED — actual repo layout** (original spec proposed `packages/ui` +
`packages/api-client`, which do not exist and are not planned):

```
masarx_next/
├── apps/
│   ├── web/               # Next.js 16 web app & PWA (source for Lite later)
│   ├── mobile/            # Expo SDK 51 / RN 0.74 (React Navigation)
│   └── desktop/           # Electron 32 host wrapping the web build
├── packages/
│   └── shared/            # i18n messages (42 namespaces × ar/en), Zod schemas,
│                          # DB types, AI types, Supabase client helpers
├── supabase/
│   ├── migrations/        # 001–008, chronological, RLS policies throughout ✅
│   └── seed.sql           # ✅ exists (levels only) → 🔨 PHASE 1 expands subjects/lectures
├── LICENSE                # ✅ MIT, Copyright (c) 2026 Masar-X
├── CONTRIBUTING.md        # ✅ exists (monorepo-specific workflows)
├── BRANDING.md            # 🔨 added in this batch
└── AGENTS.md              # ✅ agent guide (invariants, gotchas)
```

- **RLS Enforcement:** ✅ **DONE** — 41 `CREATE POLICY` statements across migrations
  002–007. 📦 PHASE 3 keeps a lightweight re-audit before the announcement.
- **Repo is already PUBLIC** — ⚠️ the original "scrub before publishing" framing is
  inverted: 🔨 **PHASE 1 runs a secret audit over tracked files** (gitleaks already in
  CI) and **reports** findings. No history rewriting.
- **Local Developer Experience:** 🔨 **PHASE 1** — expand `seed.sql` (2 levels → subjects
  + sample lectures, zero PII) and add root `pnpm db:seed`.

---

## 6. 20-Day Launch Roadmap (status-annotated)

```
[Day 1-7: Core Stability] ──> [Day 8-14: Mobile Delivery] ──> [Day 15-20: Release & Community]
 🔨 PHASE 1 (this batch)       📋 PHASE 2                      📦 PHASE 3
```

### Phase 1: Days 1–7 — Web Core & Backend Stability (🔨 current batch)
- [ ] Task 1.1: Migrate hardcoded Arabic strings → `messages/{ar,en}` keys (B1)
- [ ] Task 1.2: i18n for plain-text empty states (B2) — *web loaders already ✅*
- [ ] Task 1.3: Zain retry affordance on failed chat bubbles + error copy via i18n (B3)
- [ ] Task 1.4: Expand `seed.sql` + add `pnpm db:seed` (B6)
- [ ] Task 1.5: Footer RTL ordering fix (B4)
- [ ] Task 1.6: Subjects grid single-column below `sm` (B5)
- [ ] Task 1.7: Secret audit over tracked files (B7)

### Phase 2: Days 8–14 — Mobile Stabilization (📋)
- [ ] Task 2.1: Expo `SubjectsScreen` cards → `Pressable` + React Navigation route
- [ ] Task 2.2: Loaders/empty states on mobile screens
- [ ] Task 2.3: Mobile Zain screen error handling parity
- [ ] Task 2.4: Capacitor Lite shell (`apps/lite`) wrapping web build; extend
      `useIsDesktopRuntime` pattern with WebView detection
- [ ] Task 2.5: PWA re-verification (sw.js per-deploy cache versioning already ✅)

### Phase 3: Days 15–20 — Release & Community (📦)
- [ ] Task 3.1: RLS re-audit before announcement
- [ ] Task 3.2: BIS-fork DB cleanup (dummy lecture names, tester copy)
- [ ] Task 3.3: Seed FCAI core curricula in production admin dashboard
- [ ] Task 3.4: Launch announcement on student channels (PWA + Lite APK + desktop releases)

*(Original spec Tasks 3.3 "write CONTRIBUTING.md" and 3.4 "tag MIT release" are ✅ DONE —
LICENSE is MIT and CONTRIBUTING.md already covers the 3-step setup.)*

---

## 7. Agent Command Prompts (repo-accurate rewrites)

### Prompt A: Mobile Touch & Navigation Refactor (Expo) — 📋 Phase 2
```text
In apps/mobile/src/screens/SubjectsScreen.tsx, replace the View-based subject card
containers with Pressable components (android_ripple + opacity feedback). Wire onPress
through React Navigation (useNavigation / navigation.navigate) to the subject details
route, matching the existing navigator param list. Keep styles in the existing
StyleSheet and add TypeScript param types.
```

### Prompt B: WebView Context Sanitization (Lite shell) — 📋 Phase 2, prerequisite: Lite
```text
Extend apps/web/src/lib/desktop/useIsDesktopRuntime.ts (or add a sibling hook) to also
detect Capacitor/WebView runtimes (Capacitor.isNativePlatform() / user-agent) and use it
in DesktopAppBannerClient so Windows/macOS download CTAs never render inside mobile
wrappers. Follow the hydration-safe pattern already used for the Electron bridge.
```

### Prompt C: Brand & Copy Alignment (i18n-first) — 🔨 Phase 1
```text
Sweep apps/web/src for user-facing Arabic strings hardcoded in .ts/.tsx. For each, add
ar + en entries to the matching namespace under
packages/shared/src/messages/{ar,en}/ and replace the literal with the next-intl
translation call. Never inline replacement text (invariant I3). Do not touch TRW
features or the professorGender feature.
```
