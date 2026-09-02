#!/usr/bin/env bash
#
# check-translations.sh
#
# Spec 004 Phase 3, Task T038 -- translations centralization guard.
#
# Fails the build if any app declares its own local translations
# directory: a directory named `messages` or `locales` anywhere under
#   - apps/web/src
#   - apps/desktop
#   - apps/mobile
#
# Why: the i18n contract
# (specs/004-multi-platform-expansion/contracts/i18n-messages.md) makes
# packages/shared/src/messages/{ar,en}/ the single source of truth for
# every runtime. Per-app copies drift silently (a key updated in one copy
# but not the other, with no compile-time signal), so they are banned.
# Per-runtime loading belongs in the runtime adapters (next-intl on
# web/desktop, expo-localization + @masarx-shared/i18n on mobile), not in
# per-app JSON trees.
#
# CI integration: invoked from .github/workflows/ci.yml as the
# `translations` job. Register that job as a required status check on the
# protected branch (same one-time repo setting as ai-endpoint-grep, T014).
#
# Exit codes:
#   0 -- no local translations directory found
#   1 -- at least one local translations directory found (build fails)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Search roots, relative to the repo root. For apps/web only src/ is
# checked: its build output (.next) and node_modules live outside it.
SEARCH_ROOTS=(
  "apps/web/src"
  "apps/desktop"
  "apps/mobile"
)

# Dependency/build directories that must never be scanned: they can
# legitimately contain generated paths named `messages` (e.g. inside
# .next server chunks) and are not source-controlled translations.
PRUNE_NAMES=(-name node_modules -o -name .next -o -name .expo -o -name dist -o -name out -o -name .turbo)

violations=0
for root in "${SEARCH_ROOTS[@]}"; do
  if [[ ! -d "$root" ]]; then
    # A missing root is not an error: the tree for that app may not exist
    # yet; there is simply nothing to guard there.
    continue
  fi
  while IFS= read -r -d ' ' dir; do
    echo "::error file=${dir}::Local translations directory found: ${dir}. Translations MUST live in packages/shared/src/messages/{ar,en} (see specs/004-multi-platform-expansion/contracts/i18n-messages.md)."
    violations=$((violations + 1))
  done < <(find "$root" -type d \( "${PRUNE_NAMES[@]}" \) -prune -o -type d \( -name messages -o -name locales \) -print0)
done

if [[ "$violations" -gt 0 ]]; then
  echo
  echo "check-translations: FAILED -- ${violations} local translations directory(ies) found under apps/."
  echo "Move them into packages/shared/src/messages/{ar,en}/ and consume them"
  echo "through the runtime adapters (next-intl / @masarx-shared/i18n)."
  exit 1
fi

echo "OK: no local messages/ or locales/ directories under apps/ -- translations stay centralized in packages/shared/src/messages/."
