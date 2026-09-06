# Masar X — Agent Guide

> **TL;DR.** Full-stack Next.js 16 + React 19 monorepo (`apps/web`, `apps/desktop`, `apps/mobile`, `packages/shared`). Supabase backend. Bilingual ar/en via `next-intl`. Read this file first; only deep-dive into references when the index points you there.

**Absolute paths** (verified 2026-09-05):
- Repo: `C:/programming/WEB_Development/projects/masarx_next/`
- Web app: `apps/web/`
- Shared types/i18n/AI: `packages/shared/`
- Supabase: `supabase/` (migrations, edge functions)
- Specs: `specs/001..005/`
- Agent skills: `.agents/skills/`
- Gotchas reference: `docs/agents/references/01-gotchas.md`
- Release pipeline: `docs/agents/references/02-release-pipeline.md`

---

## 1. Project invariants (the rules you cannot break)

| # | Rule | Why |
|---|---|---|
| I1 | Service-role and AI provider keys stay **server-side only** | RLS depends on it; CI runs `ai-endpoint-grep` + gitleaks on built artifacts |
| I2 | TypeScript end-to-end: `Database` types + Zod schemas in `packages/shared` | One source of truth across web/desktop/mobile |
| I3 | i18n for **every** user-facing string. No hardcoded Arabic in components | 42 namespaces already in `packages/shared/src/messages/{ar,en}/` |
| I4 | All OAuth callbacks live under `[locale]/auth/callback/` | See gotcha #3 |
| I5 | `pnpm.neverBuiltDependencies` lives in root `package.json` under `"pnpm"` | See gotcha #8 |
| I6 | Electron version pinned exact (no `^`/`~`) in `apps/desktop/package.json` | See gotcha #11 |
| I7 | `ThemeScript.tsx` uses native `<script>` + `suppressHydrationWarning` | See gotcha #19 |
| I8 | Never destructive git ops (`stash drop`, `reset --hard`, `checkout --`, `clean -fd`) on a dirty tree without explicit user consent | See gotcha #20 |

---

## 2. Setup essentials

```bash
# Prereqs: Node >= 24, pnpm 9.15.4, Supabase project
corepack enable
pnpm install
cp .env.example .env.local    # fill in NEXT_PUBLIC_SUPABASE_*, DATABASE_URL, etc.
pnpm dev                       # http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` must be set in **Vercel production env** (not just `.env.local`) — see gotcha #6.

Verify your setup: `pnpm typecheck && pnpm lint && pnpm test`.

---

## 3. Common tasks → references

| When you are… | Read… |
|---|---|
| Touching `src/lib/supabase/server.ts`, OAuth callback, `src/navigation.ts` | [references/01-gotchas.md](./docs/agents/references/01-gotchas.md) §1, §2, §3 |
| Deploying / smoke-testing on Vercel | [references/01-gotchas.md](./docs/agents/references/01-gotchas.md) §4, §5, §6, §7, §12 |
| Adding a new dep that needs `better-sqlite3` / `electron` postinstall | [references/01-gotchas.md](./docs/agents/references/01-gotchas.md) §8, §10, §11 |
| Setting GitHub / Cloudflare / Windows env vars | [references/01-gotchas.md](./docs/agents/references/01-gotchas.md) §9, §13, §14, §15 |
| Building a desktop release or troubleshooting `electron-builder` | [references/01-gotchas.md](./docs/agents/references/01-gotchas.md) §16, §17 + [references/02-release-pipeline.md](./docs/agents/references/02-release-pipeline.md) |
| Modifying CI workflows that check source into a subdir | [references/01-gotchas.md](./docs/agents/references/01-gotchas.md) §18 |
| Touching `ThemeScript.tsx` or CSP nonce handling | [references/01-gotchas.md](./docs/agents/references/01-gotchas.md) §19 |
| Working tree is dirty and a task wants a clean state | [references/01-gotchas.md](./docs/agents/references/01-gotchas.md) §20 |

---

## 4. Architecture (30-second version)

```text
[Web: Next.js 16]   [Desktop: Electron]   [Mobile: Expo/RN]
            \              |               /
             \             |              /
              →→  packages/shared  ←←
                  ├── messages/{ar,en}/  (i18n)
                  ├── ai/                (Puter.js client, Zod schemas)
                  ├── supabase/          (client factories)
                  └── types/             (DB types + Zod)
                          ↓
                    Supabase
                  (Postgres + RLS, Auth, Storage, Edge Functions)
```

- **Web is source of truth** for product behavior; desktop + mobile are feature-parity ports.
- **AI**: client-side via Puter.js SDK (preferred, no server key leak). Server-side `/api/ai/chat` is a graceful fallback that returns helpful guidance when Puter is unavailable (not a real LLM — see `apps/web/src/app/api/ai/chat/route.ts`).
- **Storage**: Cloudinary (PDFs + images).
- **Releases**: web → Vercel. Desktop + mobile → GitHub Releases via public-runner pipeline (`fotedev/masarx-releases`). See [references/02-release-pipeline.md](./docs/agents/references/02-release-pipeline.md).

---

## 5. Repository layout (thin root)

```text
masarx_next/
├── apps/                # web (Next.js), desktop (Electron), mobile (Expo)
├── packages/shared/     # cross-platform code + i18n messages + Zod
├── supabase/            # migrations, edge functions, seed data
├── specs/               # 001..005 — SpecKit spec directories
├── docs/                # setup, product context, design, handoffs
├── scripts/             # utility scripts
├── .agents/             # this file + skills + references
├── .github/             # CI workflows
├── .vscode/, .cursor/, .windsurf/, .opencode/   # IDE metadata (shared)
├── masarx-remotion-ad/  # sibling ad project (NOT in pnpm workspace, deliberate)
├── masarx-video-ad/     # sibling video-ad project (NOT in pnpm workspace, deliberate)
├── public/              # static assets served by Next.js
├── sandbox/             # throwaway experiments (gitignored)
└── context_output/      # working dir (gitignored)
```

Full root conventions: `STRUCTURE.md`.

---

## 6. MCP and CLI quick map

| Tool | Use for | Notes |
|---|---|---|
| `vercel` CLI / MCP | deploys, env, logs, marketplace | Prefer MCP for tool-call style; CLI for scripts/CI |
| `gh` CLI / MCP | PRs, issues, repo ops, GitHub API | PAT auth on the local side |
| `supabase` CLI / MCP | schema migrations, edge fns, ad-hoc SQL | Locked to project ref `jcufigozkhxazjbwhjjm` |
| `cloudflare-api` MCP | entire CF API via Code Mode (~1k tokens) | **NOT loaded in MiniMax Code** — see gotcha #13 |
| `wrangler` (fallback) | Cloudflare when MCP unavailable | — |

At session start, run `mavis mcp list` to confirm what's actually loaded — `cloudflare-api` etc. are NOT in MiniMax Code by default.

---

## 7. Project-specific quirks

- **Bilingual by design**: every user-facing string has `ar` + `en` entries under `packages/shared/src/messages/`. Missing key → build/console warning, not a runtime crash, but DO fix before merging.
- **RTL**: `next-intl` handles `<html dir>`. Components use logical CSS (`ms-`, `me-`, `border-e-`) — never `left/right`.
- **Dark mode**: calibrated for late-night study, not just inverted. Theme switching must use the native `<script>` pattern in `apps/web/src/components/ThemeScript.tsx` (gotcha #19).
- **Service-role key**: NEVER in `NEXT_PUBLIC_*`. NEVER pasted in chat/CLI args.
- **Hardcoded strings prohibition**: any Arabic string inside `.tsx`/`.ts` that's not in `messages/ar/*.json` is a defect — migrate on touch.
- **Supabase migrations**: every change to `supabase/migrations/` MUST have a timestamp-prefixed file. Out-of-order files break `db push`.

---

## 8. Pre-commit / pre-merge checklist

Before opening a PR:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes (security-guard rules fail the build — see `ai-endpoint-grep` in `ci.yml`)
- [ ] `pnpm test` passes
- [ ] No hardcoded Arabic strings added (grep `apps/web/src --include='*.tsx' --include='*.ts'` for non-comment lines containing Arabic chars)
- [ ] No new deps without updating root `pnpm-lock.yaml` via `pnpm install`
- [ ] If you touched `supabase/`: migration timestamp is current + file is in chronological order
- [ ] If you touched `ThemeScript.tsx`: re-read gotcha #19 before any change

---

## 9. Gotcha index (read on demand)

Full gotchas: [references/01-gotchas.md](./docs/agents/references/01-gotchas.md) — 20 entries with Trigger/Why/Fix/Symptom for each. Topics covered: next-intl server bundle, supabase-ssr BOM, OAuth callback path, Vercel deployment protection, free-tier rollback limits, service-role key in Vercel env, pnpm 9.x neverBuiltDependencies, GitHub secret CRLF, webpack aliases, Electron pinning, Vercel cache purge for pnpm path mismatches, Cloudflare MCPs not loaded in MiniMax Code, Windows env var propagation, Windows env dialog empty values, GitHub Releases on private repos, electron-builder artifactName versions, pnpm/action-setup with subdir checkout, ThemeScript nonce hydration, git stash drop safety.

Release pipeline (separate file): [references/02-release-pipeline.md](./docs/agents/references/02-release-pipeline.md) — public-runner pipeline architecture, secrets model, what-it-does steps, CI workflow summary.
