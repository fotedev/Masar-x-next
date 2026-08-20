#!/usr/bin/env bash
#
# check-ai-provider-endpoints.sh
#
# Spec 004 Phase 2, Task T014 (NON-NEGOTIABLE).
#
# Fails the build if any direct AI provider API endpoint string is found
# in source files outside the two allowed locations:
#   - supabase/functions/**  (the Edge Function — the only place that
#                              may talk to the AI provider directly)
#   - packages/shared/ai/__fixtures__/**  (test fixtures — opt-in, with
#                                            the `__fixtures__` name as
#                                            the contract signal)
#
# The check is intentionally pattern-based (not import-based) because
# the contract bans BOTH `import openai` AND `fetch("https://api.openai.com/...")`.
# The ESLint no-restricted-imports rule (T013) catches the import form;
# this script catches the raw-HTTP form.
#
# Per the contract (`specs/004-multi-platform-expansion/contracts/ai-boundary.md`
# §"What the apps are NOT allowed to do"):
#
#   "❌ Make any direct call to an AI provider's API — through an SDK
#    (`openai`, `@anthropic-ai/sdk`, etc.), through raw HTTP to the
#    provider's endpoint, or through any other mechanism. All AI traffic
#    goes through the shared package, which calls the Edge Function."
#
# This script is the second of the three enforcement layers. The third
# (T015, gitleaks on built artifacts) catches the same leak at the
# key-shape level — if the endpoint string is present with a real key,
# gitleaks will see the key in the built bundle.
#
# CI integration: invoked from `.github/workflows/ci.yml` as the
# `ai-endpoint-grep` job. The job MUST be registered as a required
# status check on the protected branch (Branch protection rules →
# Require status checks to pass before merging). The registration is
# a one-time GitHub repo setting, performed via the GitHub UI or via
# `gh api` against the repo's ruleset.
#
# Exit codes:
#   0 — no direct AI provider endpoint found
#   1 — at least one direct endpoint found (build fails)
#   2 — script error (e.g. ripgrep not installed)

set -euo pipefail

# The patterns below are the canonical AI provider API hosts as of
# 2026-08-20. Add new providers here with a one-line comment when
# supporting them. Do NOT add the Edge Function's own URL here — the
# check is for direct provider calls, not the routing layer.
PATTERNS=(
  'api\.openai\.com'
  'api\.anthropic\.com'
)

# Paths to exclude. Both are absolute from the repo root. The use of
# fixed strings (not globs) keeps the matching fast and the semantics
# clear: only the Edge Function and the test fixtures are exempt.
EXCLUDES=(
  '--glob' '!supabase/functions/**'
  '--glob' '!packages/shared/ai/__fixtures__/**'
  '--glob' '!.github/scripts/check-ai-provider-endpoints.sh'
  # The contract and the spec/plan documents mention these hosts in
  # plain prose (e.g. "the openai API endpoint"). The check is about
  # code, not docs.
  '--glob' '!specs/**'
  '--glob' '!docs/**'
  '--glob' '!**/*.md'
  # gitleaks config and the contract docs reference the patterns by
  # name (e.g. for the `regex` field). Same reason as above.
  '--glob' '!.gitleaks.toml'
  # Generated lockfile may contain transitive references.
  '--glob' '!pnpm-lock.yaml'
  # This very script contains the patterns literally; we already
  # exclude it above, but the list is duplicated here for clarity
  # when reading the script.
)

# Use ripgrep for speed. If rg is unavailable, fall back to grep -R.
if command -v rg >/dev/null 2>&1; then
  SEARCH=(rg --no-heading --line-number --color=never)
else
  echo "::error::ripgrep (rg) is required for the AI-endpoint grep. Install it or update the CI image." >&2
  exit 2
fi

found=0
for pat in "${PATTERNS[@]}"; do
  echo "Checking for direct AI provider endpoint matching: $pat"
  # shellcheck disable=SC2207
  matches=$("${SEARCH[@]}" "${EXCLUDES[@]}" -e "$pat" . || true)
  if [[ -n "$matches" ]]; then
    echo "::error file=specs/004-multi-platform-expansion/contracts/ai-boundary.md::Direct AI provider endpoint found: $pat"
    echo "$matches"
    found=1
  fi
done

if [[ "$found" -ne 0 ]]; then
  echo
  echo "Build failed: direct AI provider endpoint(s) found in code."
  echo "All AI traffic MUST go through the Supabase Edge Function (see"
  echo "specs/004-multi-platform-expansion/contracts/ai-boundary.md). The"
  echo "shared AI client in packages/shared/src/ai/index.ts is the only"
  echo "allowed consumer. The Edge Function in supabase/functions/** and"
  echo "test fixtures under packages/shared/ai/__fixtures__/** are exempt."
  exit 1
fi

echo "OK: no direct AI provider endpoints found outside the allowed paths."
exit 0
