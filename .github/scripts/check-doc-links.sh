#!/usr/bin/env bash
#
# Verifies that every internal (relative) Markdown link in the first-party
# docs points at a file that exists in the repository. External URLs
# (http/https), mailto links, and pure-anchor links are skipped; fragments
# on relative targets are stripped before checking.
#
# Scope is deliberately limited to the top-level docs this repo owns
# (README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG) so the
# check cannot be broken by historical files under specs/ or docs/.
#
# Runs as part of the `docs-lint` CI job and can be run locally:
#   bash .github/scripts/check-doc-links.sh
set -euo pipefail

files=(
  "README.md"
  "CONTRIBUTING.md"
  "SECURITY.md"
  "CODE_OF_CONDUCT.md"
  "CHANGELOG.md"
)

errors=0

for f in "${files[@]}"; do
  if [ ! -f "$f" ]; then
    echo "::error::Expected doc file is missing: $f"
    errors=$((errors + 1))
    continue
  fi

  dir=$(dirname "$f")

  # Extract every [text](target) / ![alt](target) target from the file.
  while IFS= read -r target; do
    case "$target" in
      http://* | https://* | mailto:* | "#"*) continue ;;
    esac

    path="${target%%#*}"
    [ -z "$path" ] && continue

    # Decode percent-escapes (e.g. %20) before testing existence.
    decoded=$(printf '%b' "${path//%/\\x}")

    if [ ! -e "$dir/$decoded" ]; then
      echo "::error file=$f::Broken internal link: ($target)"
      errors=$((errors + 1))
    fi
  done < <(grep -oE '\[[^]]*\]\([^)]+\)' "$f" | sed -E 's/^\[[^]]*\]\(//; s/\)$//')
done

if [ "$errors" -gt 0 ]; then
  echo "::error::$errors broken internal link(s) found."
  exit 1
fi

echo "All internal Markdown links resolve."
