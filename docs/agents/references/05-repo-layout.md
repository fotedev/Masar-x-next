# Repository layout (thin root)

```text
masarx_next/
├── apps/                # web (Next.js — /materials, /schedules; static assets at apps/web/public/), desktop (Electron), mobile (Expo)
├── packages/shared/     # cross-platform code + i18n messages + Zod
├── supabase/            # migrations, edge functions, tests, legacy chain archive (migrations-archive/)
├── specs/               # SpecKit spec directories (NNN_ numbering derived from disk, see [10-spec-first.md](./10-spec-first.md))
├── docs/                # setup, product context, design, handoffs
├── scripts/             # utility scripts
├── .agents/             # machine-local agent files + skills (gitignored, never committed)
├── .github/             # CI workflows
├── .vscode/, .cursor/, .windsurf/, .opencode/   # IDE metadata (shared)
├── masarx-remotion-ad/  # sibling ad project (NOT in pnpm workspace, deliberate)
├── masarx-video-ad/     # sibling video-ad project (NOT in pnpm workspace, deliberate)
├── promo_assets/        # brand/promo assets + promo build scripts
├── LICENSE, NOTICE.md   # AGPL-3.0 for code; content + brand All Rights Reserved
├── deno.lock            # Deno lockfile (Supabase edge functions)
├── sandbox/             # throwaway experiments (gitignored)
└── context_output/      # working dir (gitignored)
```

Full root conventions: `STRUCTURE.md`.

**Back to:** [AGENTS.md](../../../AGENTS.md)
