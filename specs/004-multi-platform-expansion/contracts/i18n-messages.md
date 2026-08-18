# Contract: i18n Messages

This contract defines how translation messages are shared across the three apps, and the rules for adding or changing a key. The source of truth is the JSON files in `packages/shared/src/messages/`. Each runtime consumes them through a per-runtime adapter.

## What the shared package exports

```text
packages/shared/src/messages/
├── ar.json           # Arabic translations
├── en.json           # English translations
└── types.ts          # Generated: the union of all keys, both languages
```

The `types.ts` file is auto-generated from the JSON files. It exports a type that, for each key, requires both `ar` and `en` to be present. **A key without a translation in both languages is a build-time error.**

## What each runtime does

- **Web**: `next-intl` loads the messages from the shared package at build time. Existing setup; no behavior change.
- **Desktop**: The Electron app's local Next.js server loads the same messages. No new code path on the renderer side.
- **Mobile**: `expo-localization` reads the device's preferred language, and the shared package's `i18n/index.ts` exports a `t(key, locale?)` helper that returns the right string.

## Rules for adding a new key

1. Add the key to **both** `ar.json` and `en.json` in the same PR.
2. Use the existing key naming convention (camelCase, grouped by feature: `auth.signIn`, `summary.uploadPdf`, `ai.typing`).
3. Reference the key in the app code using the per-runtime helper. Do not import the JSON file directly.
4. Run `pnpm typecheck` to confirm the generated `types.ts` is consistent.

A PR that adds a key to only one language is rejected at code review.

## Rules for changing an existing key

Renames are treated as remove + add. A key rename is one PR:

1. Add the new key (with both languages) in the same commit.
2. Replace all uses of the old key with the new key in the same commit.
3. Remove the old key in the same commit.

A partial rename (added in one PR, removed in another) is rejected — it leaves the build in a state where one runtime has the new key and another has the old one, and there's no compile-time signal for which is which.

## What this contract does NOT cover

- **Plural forms**: the current JSON format is flat. If/when a key needs `zero` / `one` / `two` / `few` / `many` / `other` forms, the schema is extended (not the v1 schema). This is recorded for awareness; the v1 product does not need it.
- **Right-to-left handling**: RTL is handled by each runtime's layout system, not by the message file. The Arabic values are the strings; the direction is the app's responsibility (spec FR-008).
- **Translation management platforms (Crowdin, Lokalise)**: not used in v1. If added later, they integrate at the JSON-file level, not below it.
