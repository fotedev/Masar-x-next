# Data Model: 004 — Multi-Platform Expansion

**Date**: 2026-08-17
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

This document describes the entities introduced or modified by the multi-platform expansion. The existing Supabase schema is the source of truth for all user data; this feature does not introduce platform-specific tables. New entities below are either (a) the shared package's type definitions that mirror existing Supabase tables, or (b) local-only caches and configuration that live on the device, not in the database.

## Entity overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Existing Supabase (unchanged)                                       │
│  ────────────────────────────                                         │
│  • user_profile, study_summary, quiz, video, subject,                │
│    ai_conversation, ai_message, file_upload,                        │
│    appeal, rate_limit_bucket, ...                                   │
│  • Row Level Security policies on every user-data table             │
│  • Edge Functions: ai-chat, upload-file, password-reset, ...        │
└─────────────────────────────────────────────────────────────────────┘
            │                                              │
            │ types re-exported by                       │ consumed by
            │ packages/shared/types                      │
            ▼                                              ▼
┌──────────────────────────────────┐  ┌────────────────────────────────┐
│  packages/shared/types           │  │  apps/web, apps/desktop,        │
│  ───────────────────────────     │  │  apps/mobile                    │
│  • DatabaseRow<T>                │  │  ────────────────               │
│  • UserProfile, StudySummary,    │  │  Each app calls into Supabase   │
│  • Quiz, AiMessage, FileUpload   │  │  via packages/shared/supabase   │
│  • ... (mirrors DB schema)       │  │  factory, gets strongly-typed  │
│  • ClientManifest (new)          │  │  responses back.                │
└──────────────────────────────────┘  └────────────────────────────────┘
            │
            │ generated at build time
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  New local-only entities (per-device, not in Supabase)               │
│  ───────────────────────────────────────────────────                 │
│  • LocalAuthSession (web: cookies, desktop: encrypted file,          │
│                      mobile: SecureStore)                           │
│  • LocalReadCache (desktop: SQLite, mobile: AsyncStorage)            │
│  • ClientBuildInfo (web: n/a, desktop: app.getVersion(),             │
│                     mobile: expo-constants)                         │
│  • UpdateChannel (desktop only: stable / beta)                      │
└─────────────────────────────────────────────────────────────────────┘
```

## New type definitions (packages/shared/types)

These are TypeScript types that the shared package exports. They are not database tables — they are the typed shape that the apps use to talk to the existing Supabase tables. Generated from the Supabase schema; regenerated on each schema migration.

### `DatabaseRow<T extends keyof DatabaseSchema>`

- **What it represents**: A typed row from a specific Supabase table.
- **Key attributes**: `id: string`, `created_at: string` (ISO 8601), `updated_at: string`, plus the table-specific columns.
- **Relationships**: Imported by the apps' data-access code; never persisted locally.

### `UserProfile`

- **What it represents**: The shape of `public.user_profile` (existing table).
- **Key attributes**: `id`, `email`, `display_name`, `preferred_language` (`'ar' | 'en'`), `created_at`, `subscription_tier`.
- **Relationships**: Referenced by `StudySummary`, `AiConversation`, `Appeal`, etc. (existing relations; unchanged).

### `StudySummary`

- **What it represents**: The shape of `public.study_summary` (existing table).
- **Key attributes**: `id`, `user_id`, `subject_id`, `title`, `body` (markdown + LaTeX), `file_upload_id` (nullable), `created_at`.
- **Relationships**: `user_id` → `UserProfile`; `subject_id` → `Subject`; `file_upload_id` → `FileUpload`.

### `AiConversation`, `AiMessage`

- **What it represents**: Conversation and message rows in the existing AI-tutor tables.
- **Key attributes (AiMessage)**: `id`, `conversation_id`, `role` (`'user' | 'assistant' | 'system'`), `content` (markdown), `created_at`.
- **Relationships**: `conversation_id` → `AiConversation`; `user_id` (transitively via `AiConversation`).
- **Spec alignment**: This shape is the same across all three platforms; the mobile app's offline read cache stores these for the last N conversations.

### `FileUpload`

- **What it represents**: Metadata for files in Supabase Storage.
- **Key attributes**: `id`, `user_id`, `storage_path`, `mime_type`, `size_bytes`, `created_at`.
- **Relationships**: `user_id` → `UserProfile`; referenced by `StudySummary` and `Appeal`.

### `ClientManifest` (new — does not exist in the database)

- **What it represents**: A build-time JSON file that lists the platform, the build version, the API surface the client expects, and the supported features for the current build.
- **Key attributes**: `platform` (`'web' | 'desktop' | 'mobile'`), `build_version` (semver), `supabase_url`, `supported_features` (string list, e.g. `['auth.email', 'auth.google', 'ai.chat', 'file_upload']`), `min_supported_app_version` (mobile only — for forcing upgrades).
- **Relationships**: Generated at build time by each app's build pipeline. Injected into the bundle as a constant. The web app reads it from a `process.env`; the desktop app reads it from a JSON file in the asar; the mobile app reads it from `expo-constants`.
- **Spec alignment**: FR-001 (installer outcome) and FR-022 (independent build) both benefit from a build-time manifest — every platform can self-describe what's available.

## New local-only entities

These are stored on the device, not in Supabase. They are designed to be cleared without data loss.

### `LocalAuthSession`

- **What it represents**: The Supabase auth tokens, persisted locally so the user doesn't re-authenticate on every launch.
- **Storage**:
  - **Web**: cookies (existing behavior, unchanged).
  - **Desktop**: encrypted JSON file in the Electron userData dir (key derived from machine ID + a per-install secret; not exported).
  - **Mobile**: `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android).
- **Key attributes**: `access_token`, `refresh_token`, `expires_at`, `user_id`.
- **Lifecycle**: Cleared on sign-out (FR-004). Refreshed silently when within 5 min of expiry. Prompted re-login when refresh fails.
- **Spec alignment**: FR-004 (desktop session persistence), FR-014 (auth continuity), Edge case "session expires mid-review → silent refresh, prompt only on failure".

### `LocalReadCache`

- **What it represents**: A local cache of previously-fetched study content for offline read.
- **Storage**:
  - **Desktop**: SQLite (e.g. `better-sqlite3`).
  - **Mobile**: AsyncStorage with a JSON envelope; the data volume is small for v1.
- **Key attributes (per cache entry)**: `key` (e.g. `study_summary:{id}`), `value` (the row), `cached_at`, `expires_at`.
- **Lifecycle**: Read-through; entries are refreshed in the background when the network is available. On offline, the app shows "offline, showing cached version" with a timestamp.
- **Spec alignment**: Spec FR-011 (offline read), Edge case "user is offline on mobile and tries to review a card that was not yet cached".

### `ClientBuildInfo`

- **What it represents**: The current app's version, build number, and platform. Used to:
  - Decide whether to apply a desktop auto-update (FR-005).
  - Decide whether to force a mobile app upgrade (FR-M01 → v1 only, optional).
  - Surface in error reports.
- **Storage**: Build-time constant; not mutable at runtime.
- **Key attributes**: `app_version` (semver), `build_number` (monotonic int), `platform`, `channel` (desktop: `stable` / `beta`; mobile: `production` / `preview`).
- **Spec alignment**: FR-005 (auto-update), Edge case "auto-update downloads but fails to apply on restart → revert".

### `UpdateChannel`

- **What it represents**: A user-selected update channel (desktop only).
- **Storage**: JSON in the Electron userData dir, settable from the app menu.
- **Key attributes**: `channel` (`'stable' | 'beta'`), `last_changed_at`.
- **Spec alignment**: Research decision §6 mentions a documented release channel; this is the local-state side of that.

## State transitions

The new local entities are not state machines. The existing Supabase entities' state transitions are unchanged. The plan does not introduce any new server-side state machine.

## Validation rules

The shared package's types are the source of truth for shape. Runtime validation (Zod) is applied at the boundary between the network and the app — every Supabase response is parsed through a Zod schema in `packages/shared/types/schemas/`. The schema is auto-generated from the Supabase types and committed to the repo. Mismatches between the schema and the actual response fail fast in dev and are reported (not crashed on) in production.

## Migration impact on existing schema

**None.** The plan does not modify the existing Supabase schema. The types in `packages/shared/types/` mirror the existing tables. When the schema changes, the types are regenerated and the apps are updated. This is a planning-level convention, not a runtime invariant.

## Out-of-scope entities (recorded for clarity)

The following are **not** introduced by this plan, even though they might seem obvious:

- **Push notification tokens table**: out of scope per spec (SRS is out).
- **Device inventory table**: not needed for v1; auto-update uses the per-device local state only.
- **Apple Sign-In provider row**: out of scope per spec.
- **Custom URL protocol handler registration**: out of scope per spec.
- **Tablet-form-factor layout configuration**: out of scope per spec.

These are listed in the spec's "Explicitly Out of Scope" section and re-listed here so a future implementer does not assume they were forgotten.
