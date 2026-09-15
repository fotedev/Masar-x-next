# Architecture (30-second version)

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
- **Releases**: web → Vercel. Desktop + mobile → GitHub Releases on this same (public) repo via `.github/workflows/release.yml`. See [02-release-pipeline.md](./02-release-pipeline.md).

**Back to:** [AGENTS.md §4](../../../../AGENTS.md)
