#!/usr/bin/env bash
#
# REVERT_PLAN.sh — Reverse the reorganization executed by organize-root v2.3.
#
# Generated:     2026-09-03 10:46
# Project root:  C:/programming/WEB_Development/projects/masarx_next
# Baseline HEAD: a3e37f1 (on wip/spec-004-landing)
# Source skill:  organize-root v2.3 (SKILL.md Phase 3b)
#
# Usage:
#   bash REVERT_PLAN.sh
#
# Safety:
#   - Refuses to run outside a git work tree.
#   - Each reverse-move is guarded with an existence check (idempotent).
#   - Refuses to overwrite an existing file at the destination.
#   - Operations run in REVERSE order so nested paths restore cleanly.

set -euo pipefail

GIT_ROOT="$(git rev-parse --show-toplevel)"
cd "$GIT_ROOT"

echo "Reverting reorganization in: $GIT_ROOT"
echo

revert_move() {
  local new_path="$1"
  local old_path="$2"

  if [ ! -e "$new_path" ]; then
    echo "  [skip] already reverted or missing: $new_path"
    return 0
  fi

  if [ -e "$old_path" ]; then
    echo "  [conflict] destination already exists, refusing to overwrite: $old_path"
    echo "             Please resolve manually before continuing."
    return 1
  fi

  git mv "$new_path" "$old_path"
  echo "  [ok] $new_path -> $old_path"
}

# --- Reverse moves (opposite order of execution) --------------------------
# Generated from STRUCTURE_PROPOSAL.md Phase 3.

revert_move "docs/legacy/REORGANIZATION_PLAN.md"   "REORGANIZATION_PLAN.md"
revert_move "docs/SMOKE_TEST_REPORT.md"           "SMOKE_TEST_REPORT.md"
revert_move "docs/PRODUCT.md"                     "PRODUCT.md"
revert_move "docs/FEATURES.md"                    "FEATURES.md"
revert_move ".specify/pnpm-list.json"             "pnpm-list.json"
revert_move "scripts/verify_keys.py"              "verify_keys.py"
revert_move "scripts/verify_courses.py"           "verify_courses.py"
revert_move "scripts/sql/SQL_FIX_VIDEOS_RATINGS.sql" "SQL_FIX_VIDEOS_RATINGS.sql"
# (Move #9 — context_output/ — was flagged, not executed; no reverse needed)

# --- Verification ---------------------------------------------------------

echo
echo "Revert complete. Verifying..."
if git status --porcelain | grep -q .; then
  echo
  echo "[warn] Working tree still has changes after revert."
  echo "       Inspect with: git status"
else
  echo "[ok] Working tree matches pre-reorganization state."
fi
