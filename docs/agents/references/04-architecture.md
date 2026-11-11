# Architecture (30-second version)

```text
[Web: Next.js 16]   [Desktop: Electron]   [Mobile: Expo/RN]
            \              |               /
             \             |              /
              →→  packages/shared  ←←
                  ├── messages/{ar,en}/  (translation JSON)
                  ├── i18n/              (t() runtime — mobile)
                  ├── format/            (locale-aware date formatting)
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
- **Content**: `/materials` static-manifest library (exam bank seeded to prod) and `/schedules` weekly cohort timetables (static JSON).
- **Data model**: `subject_id uuid` + FK anchors subject_lectures / subject_summaries / quizzes to subjects (`sync_subject_id()` triggers — migration `20261107030416_subject_anchoring.sql`).
- **Metrics + rate limiting**: Upstash Redis via plain REST, fail-open — metrics in `apps/web/src/lib/metrics.ts`, rate limiting in `apps/web/src/lib/rate-limit.ts`, admin view at `/api/admin/metrics`.
- **Releases**: web → Vercel. Desktop + mobile → GitHub Releases on this same (public) repo via `.github/workflows/release.yml`. See [02-release-pipeline.md](./02-release-pipeline.md).

**Back to:** [AGENTS.md](../../../AGENTS.md)
