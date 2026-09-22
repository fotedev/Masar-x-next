# Setup essentials

```bash
# Prereqs: Node >= 24, pnpm 9.15.4, Supabase project
corepack enable
pnpm install
cp .env.example .env.local    # fill in NEXT_PUBLIC_SUPABASE_*, DATABASE_URL, etc.
pnpm dev                       # http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` must be set in **Vercel production env** (not just `.env.local`) — see [01-gotchas.md §6](./01-gotchas.md). Verify with `pnpm typecheck && pnpm lint && pnpm test`.

Full human setup walkthrough (689 lines, may lag behind this file): [`docs/SETUP.md`](../../SETUP.md). This file is the source of truth for agent prerequisites.

**Back to:** [AGENTS.md](../../../AGENTS.md)
