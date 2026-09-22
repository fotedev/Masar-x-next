# Repository layout (thin root)

```text
masarx_next/
├── apps/                # web (Next.js), desktop (Electron), mobile (Expo)
├── packages/shared/     # cross-platform code + i18n messages + Zod
├── supabase/            # migrations, edge functions, seed data
├── specs/               # SpecKit spec directories (NNN_ numbering derived from disk, see [10-spec-first.md](./10-spec-first.md))
├── docs/                # setup, product context, design, handoffs
├── scripts/             # utility scripts
├── .agents/             # AGENTS.md + skills + references index
├── .github/             # CI workflows
├── .vscode/, .cursor/, .windsurf/, .opencode/   # IDE metadata (shared)
├── masarx-remotion-ad/  # sibling ad project (NOT in pnpm workspace, deliberate)
├── masarx-video-ad/     # sibling video-ad project (NOT in pnpm workspace, deliberate)
├── public/              # static assets served by Next.js
├── sandbox/             # throwaway experiments (gitignored)
└── context_output/      # working dir (gitignored)
```

Full root conventions: `STRUCTURE.md`.

**Back to:** [AGENTS.md](../../../AGENTS.md)
