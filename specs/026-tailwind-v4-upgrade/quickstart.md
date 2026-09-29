# Quickstart: 026 — verify the Tailwind v4 upgrade locally

All commands run from the repo root on `feat/026-tailwind-v4-upgrade` unless noted. Node 20+ required.

## 1. Install & build

```bash
pnpm install                                  # after deps swap in apps/web/package.json
pnpm --filter web build                       # webpack mode; must complete with zero Tailwind/PostCSS errors
```

## 2. Dev boot smoke

```bash
pnpm --filter web dev
# open http://localhost:3000 — home, one subject page, AI chat, admin shell
# toggle dark mode (ThemeScript-driven) — tokens must switch identically to v3
# check the AI assistant action row on a tablet viewport — hover-device behavior unchanged
```

## 3. Rename-sweep gates (SC-002)

```bash
cd apps/web
grep -rE "outline-none|bg-gradient-to-|bg-opacity-|flex-shrink-|flex-grow-" src/ | wc -l   # must be 0
grep -rE "shadow-sm" src/ | grep -vE "shadow-sm-" | wc -l                                   # 0 after C3 (v3 meaning)
grep -rE "\bblur-sm\b" src/ ; grep -rE "\brounded-sm\b" src/ ; grep -rE "\bbackdrop-blur-sm\b" src/   # audit each
grep -rE "\bring\b(?!-)" src/ --include='*.tsx' -P | wc -l                                  # bare ring = 0 after C4
```

(Adjust per contract §2 — every renamed row must reach 0 v3-spelling hits.)

## 4. Full gates (Story 4)

```bash
pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test
pnpm --filter web test:e2e
git diff --stat main...HEAD -- . ':!apps/web' | wc -l    # must be 0 (FR-010 scope isolation; spec/ and AGENTS.md doc commits excepted)
```

## 5. Visual parity matrix (SC-004)

| Page | light ar | dark ar | light en | dark en |
|---|---|---|---|---|
| Home | ☐ | ☐ | ☐ | ☐ |
| Subject detail | ☐ | ☐ | ☐ | ☐ |
| Quiz play | ☐ | ☐ | ☐ | ☐ |
| AI chat (markdown, code block, math) | ☐ | ☐ | ☐ | ☐ |
| Admin shell (drawer, tooltip, badge-pop) | ☐ | ☐ | ☐ | ☐ |
| Desktop shell (custom titlebar, assistant panel) | ☐ | ☐ | ☐ | ☐ |

### 5.1 Bare-border computed check (finding A1)

Confirm via DevTools computed styles (or an automated probe) that `border-color` on three representative bare-`border` samples still resolves to gray-200 — `rgb(229, 231, 235)` — in light mode, never `currentColor`:

| Sample | Where to look | Expected computed border-color |
|---|---|---|
| Card | any card element styled with a bare `border` utility | `rgb(229, 231, 235)` |
| Input | a form input styled with a bare `border` utility | `rgb(229, 231, 235)` |
| Divider | a `divide-y` list container (child border) | `rgb(229, 231, 235)` |

A sample computing to `currentColor` means the v3-defaults restoration layer (research D2) is not applied — block merge until fixed.

## 6. CSS size comparison (SC-005)

```bash
# v3 baseline (before C1):
find apps/web/.next -name "*.css" -exec du -ch {} + | tail -1
# v4 (after C2+): same command; record both in the PR description
```

## 7. Rollback

Single-branch feature: `git revert` of the C1–C5 commits, or revert the merge PR. No data/schema involved.
