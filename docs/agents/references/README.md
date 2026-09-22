# Agent references — index

Start here when AGENTS.md points you at a task. Read only what the task needs.

| When you are… | Read… |
|---|---|
| Setting up / verifying the workspace | [00-setup.md](./00-setup.md) |
| Touching `src/lib/supabase/server.ts`, OAuth callback, `src/navigation.ts` | [01-gotchas.md](./01-gotchas.md) |
| Deploying / smoke-testing on Vercel | [01-gotchas.md](./01-gotchas.md) (Deploy + Vercel cluster) |
| Adding a new dep that needs `better-sqlite3` / `electron` postinstall | [01-gotchas.md](./01-gotchas.md) (pnpm + Electron cluster) |
| Setting GitHub / Cloudflare / Windows env vars | [01-gotchas.md](./01-gotchas.md) (Env + Cloudflare cluster) |
| Building a desktop release or troubleshooting `electron-builder` | [01-gotchas.md](./01-gotchas.md) + [02-release-pipeline.md](./02-release-pipeline.md) |
| Modifying CI workflows that check source into a subdir | [01-gotchas.md](./01-gotchas.md) (CI cluster) |
| Touching `ThemeScript.tsx` or CSP nonce handling | [01-gotchas.md](./01-gotchas.md) §19 |
| Working tree is dirty and a task wants a clean state | [01-gotchas.md](./01-gotchas.md) §20 |
| Starting a non-trivial change (refactor, schema/API/auth, cross-cutting architecture, multi-component feature) | [10-spec-first.md](./10-spec-first.md) + existing example specs in `specs/` |
| Committing, opening a PR, or checking pre-merge gates | [11-git-standards.md](./11-git-standards.md) + [08-precommit.md](./08-precommit.md) |
| Need the full rule table (all 13 invariants) | [03-invariants.md](./03-invariants.md) |

**Back to:** [AGENTS.md](../../../AGENTS.md)
