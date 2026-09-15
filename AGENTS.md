# Masar X — Agent Guide

> **TL;DR.** Full-stack Next.js 16 + React 19 monorepo (`apps/web`, `apps/desktop`, `apps/mobile`, `packages/shared`). Supabase backend. Bilingual ar/en via `next-intl`. This file is the **index only** — sections 4–9 live in `docs/agents/references/`; §10 (Spec-First) and §11 (Git Standards) stay inline because they shape every commit and PR.

**Absolute paths** (verified 2026-09-05):
- Repo: `C:/programming/WEB_Development/projects/masarx_next/`
- Web app: `apps/web/`
- Shared types/i18n/AI: `packages/shared/`
- Supabase: `supabase/` (migrations, edge functions)
- Specs: `specs/` (next spec number is always derived from disk — §10.2)
- Agent skills: `.agents/skills/`
- References index: `docs/agents/references/`

---

## 1. Project invariants (the rules you cannot break)

| # | Rule | Why |
|---|---|---|
| I1 | Service-role and AI provider keys stay **server-side only** | RLS depends on it; CI runs `ai-endpoint-grep` + gitleaks on built artifacts |
| I2 | TypeScript end-to-end: `Database` types + Zod schemas in `packages/shared` | One source of truth across web/desktop/mobile |
| I3 | i18n for **every** user-facing string. No hardcoded Arabic in components | 46 namespaces in `packages/shared/src/messages/{ar,en}/` |
| I4 | All OAuth callbacks live under `[locale]/auth/callback/` | See [01-gotchas.md](./docs/agents/references/01-gotchas.md) §3 |
| I5 | `pnpm.neverBuiltDependencies` lives in root `package.json` under `"pnpm"` | See [01-gotchas.md](./docs/agents/references/01-gotchas.md) §8 |
| I6 | Electron version pinned exact (no `^`/`~`) in `apps/desktop/package.json` | See [01-gotchas.md](./docs/agents/references/01-gotchas.md) §11 |
| I7 | `ThemeScript.tsx` uses native `<script>` + `suppressHydrationWarning` | See [01-gotchas.md](./docs/agents/references/01-gotchas.md) §19 |
| I8 | Never destructive git ops (`stash drop`, `reset --hard`, `checkout --`, `clean -fd`) on a dirty tree without explicit user consent | See [01-gotchas.md](./docs/agents/references/01-gotchas.md) §20 |
| I9 | **No direct file deletion.** Agents never run `rm`/`git rm`/`del` on project files. To retire a dead or obsolete file: ask the user explicitly first, and on approval **move it to `.trash/`** (mirroring its original path; `.trash/` is gitignored) instead of deleting | Deletion from the working tree is irreversible; the user audits every removal and keeps a local archive |
| I10 | **Pasted model output is welcome — Validate & Adapt.** Raw copy-pasted text from other AI models is accepted as normal input (this is the user's primary phone-first workflow), but the agent must run full engineering validation before executing: match every snippet and claim against the actual repo state and real installed library versions, fix errors and hallucinations, adapt paths/names/APIs to project conventions — never blind application, never absolute rejection | Pasted model answers routinely reference files/APIs/states that don't exist here; validating and adapting before executing is what prevents AI-spaghetti accumulation |
| I11 | **Spec-first workflow.** No writing or modifying code for any task beyond trivial, direct fixes without a technical spec prepared and **approved by the user** first | Prevents unplanned dives into large/complex files and unreviewed architectural drift; see §10 Spec-First development standard |
| I12 | **MVP Lock** — no trivial/cosmetic/refactor work until MVP launch (see MVP Lock section below) | Owner directive 2026-09-14; school year starts within days |

---

## MVP Lock: Zero Trivial Modifications

> حتى إطلاق النسخة الأولية (MVP) وبداية العام الدراسي، يُحظر على جميع الوكلاء (Agents) القيام بأي تعديلات تافهة، أو تحسينات تجميلية هامشية، أو إعادة كتابة أكواد تعمل بالفعل (Refactoring)، أو نقاشات بصرية دقيقة.
>
> يقتصر العمل حصراً على:
> 1. الوظائف الأساسية المعطلة (Blocking / Functional Bugs).
> 2. استقرار تصفح وعرض المواد والمحاضرات (Core Study Flow).
> 3. تسجيل الدخول وحفظ البيانات الأساسية للطلاب والمشرفين.
> 4. جاهزية النشر (Production Deployment Readiness).

**English gloss:** Until the MVP launch and the start of the academic year, agents must not make trivial edits, marginal cosmetic improvements, refactors of already-working code, or pixel-level visual debates. Allowed work ONLY: (1) blocking/functional bugs; (2) stability of the core study flow (browsing and viewing subjects & lectures); (3) login and saving essential student/staff data; (4) production deployment readiness. This lock is lifted only by an explicit owner decision.

---

## 2. Setup essentials

```bash
# Prereqs: Node >= 24, pnpm 9.15.4, Supabase project
corepack enable
pnpm install
cp .env.example .env.local    # fill in NEXT_PUBLIC_SUPABASE_*, DATABASE_URL, etc.
pnpm dev                       # http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` must be set in **Vercel production env** (not just `.env.local`) — see [01-gotchas.md §6](./docs/agents/references/01-gotchas.md). Verify with `pnpm typecheck && pnpm lint && pnpm test`.

---

## 3. Common tasks → references

| When you are… | Read… |
|---|---|
| Touching `src/lib/supabase/server.ts`, OAuth callback, `src/navigation.ts` | [01-gotchas.md](./docs/agents/references/01-gotchas.md) |
| Deploying / smoke-testing on Vercel | [01-gotchas.md](./docs/agents/references/01-gotchas.md) (Deploy + Vercel cluster) |
| Adding a new dep that needs `better-sqlite3` / `electron` postinstall | [01-gotchas.md](./docs/agents/references/01-gotchas.md) (pnpm + Electron cluster) |
| Setting GitHub / Cloudflare / Windows env vars | [01-gotchas.md](./docs/agents/references/01-gotchas.md) (Env + Cloudflare cluster) |
| Building a desktop release or troubleshooting `electron-builder` | [01-gotchas.md](./docs/agents/references/01-gotchas.md) + [02-release-pipeline.md](./docs/agents/references/02-release-pipeline.md) |
| Modifying CI workflows that check source into a subdir | [01-gotchas.md](./docs/agents/references/01-gotchas.md) (CI cluster) |
| Touching `ThemeScript.tsx` or CSP nonce handling | [01-gotchas.md §19](./docs/agents/references/01-gotchas.md) |
| Working tree is dirty and a task wants a clean state | [01-gotchas.md §20](./docs/agents/references/01-gotchas.md) |
| Starting a non-trivial change (refactor, schema/API/auth, cross-cutting architecture, multi-component feature) | §10 Spec-First + existing example specs in `specs/` |
| Need architecture, repo layout, MCP/CLI map, quirks, or precommit checklist | [docs/agents/references/](./docs/agents/references/) (§4–§8 below) |

---

## 4. Architecture
→ [docs/agents/references/04-architecture.md](./docs/agents/references/04-architecture.md)

## 5. Repository layout
→ [docs/agents/references/05-repo-layout.md](./docs/agents/references/05-repo-layout.md)

## 6. MCP and CLI quick map
→ [docs/agents/references/06-mcp-cli.md](./docs/agents/references/06-mcp-cli.md)

## 7. Project-specific quirks
→ [docs/agents/references/07-quirks.md](./docs/agents/references/07-quirks.md)

## 8. Pre-commit / pre-merge checklist
→ [docs/agents/references/08-precommit.md](./docs/agents/references/08-precommit.md)

## 9. Gotcha index (read on demand)

Full gotchas: [docs/agents/references/01-gotchas.md](./docs/agents/references/01-gotchas.md) — 20 entries with Trigger/Why/Fix/Symptom for each. Topics covered: next-intl server bundle, supabase-ssr BOM, OAuth callback path, Vercel deployment protection, free-tier rollback limits, service-role key in Vercel env, pnpm 9.x neverBuiltDependencies, GitHub secret CRLF, webpack aliases, Electron pinning, Vercel cache purge for pnpm path mismatches, Cloudflare MCPs not loaded in MiniMax Code, Windows env var propagation, Windows env dialog empty values, GitHub Releases on private repos (historical, resolved 2026-09), electron-builder artifactName versions, pnpm/action-setup with subdir checkout, ThemeScript nonce hydration, git stash drop safety.

Release pipeline: [docs/agents/references/02-release-pipeline.md](./docs/agents/references/02-release-pipeline.md) — public-runner pipeline architecture, secrets model, what-it-does steps, CI workflow summary.

---

## 10. Spec-First development standard

Invariant I11 in practice: no agent starts writing or modifying code for any task beyond trivial, direct fixes without a **technical spec prepared and approved by the user first**.

### 10.1 When a formal spec is required (triggers)

- Refactoring or splitting any file over ~300 lines (current examples: `apps/web/src/app/[locale]/add-summary/page.tsx` at 945 lines, `apps/web/src/app/[locale]/profile/page.tsx` at 813).
- Any change to API contracts, database schemas/migrations, or auth flows.
- Cross-cutting architectural changes: caching, state management, runtime/environment upgrades (e.g. a major Electron version bump).
- New features spanning more than one component or route.

### 10.2 Spec anatomy

Specs live in `specs/NNN_name/`. Numbering is **dynamic auto-increment, derived from disk only**: inspect the `specs/` directory, take the highest existing `NNN` prefix, and generate the next number as `max + 1`, zero-padded to three digits (`String(max + 1).padStart(3, "0")`). Never assume, pin, or recall a spec number from memory or prior instructions — the disk is the single source of truth (same convention as `NNN_` migrations, see [07-quirks.md](./docs/agents/references/07-quirks.md)). Follow the established SpecKit layout of the existing spec directories (`spec.md`, `tasks.md`, `checklists/`). A spec must cover:

1. **Context & problem statement** — what is wrong today and why change it.
2. **Architecture & design** — components created/modified, each with a single responsibility; data flow; contracts (types / interfaces / Zod schemas).
3. **Behavior preservation & regression strategy** — how existing behavior stays intact, and how that is proven.
4. **Test specification** — unit/integration scenarios to be written to verify the change.
5. **Atomic execution plan** — sequence of independent commits, with the §8 verification gates for each.

The user approves the spec before implementation begins.

### 10.3 Lightweight path (no separate spec)

- Routine i18n extraction batches, typo fixes, and simple lint fixes do **not** need a separate spec.
- They still require a short **inline plan** (e.g. a plan-mode plan) presented to and approved by the user immediately before execution.

---

## 11. 🛠 Git Standards & Contribution Protocol

All autonomous workflows, fixes, and contributions within this repository must strictly adhere to the following conventions:

### 11.1 Conventional Commits Standard
All commit messages must follow the standard format:
`<type>(<scope>): <short summary in imperative present tense>`

- **Types allowed:**
  - `feat`: A new feature
  - `fix`: A bug fix
  - `refactor`: Code changes that neither fix a bug nor add a feature
  - `docs`: Documentation updates only
  - `test`: Adding or correcting tests
  - `chore`: Maintenance, dependency, or config updates
- **Scope:** Mandatory when targeting a specific subsystem or module (e.g., `cli`, `gateway`, `storage`, `auth`).
- **Examples:**
  - `fix(cli): honour key_env in config.yaml model.aliases entries`
  - `feat(gateway): add fallback route for session overrides`

### 11.2 Issue Linking & Traceability
- Every pull request description or commit closing an issue must explicitly link the upstream reference using keywords (`Fixes #<id>`, `Closes #<id>`, or `Refs <org>/<repo>#<id>`).
- Provide clear context in PR bodies explaining the root cause and the operational impact of the change.

### 11.3 PR Cleanliness & Diff Guardrails
- **Minimal Diffs:** Never pollute PRs with unrelated workspace files, unnecessary lockfile recreations, or mass formatting changes. Keep changes scoped strictly to the problem.
- **Branch Synchronization:** Before creating a PR or pushing changes, always fetch and rebase against the latest `upstream/main` (or default target branch) to avoid divergent histories and bloated diff counts.
- **Verification:** Ensure that you can trace and explain every modified line. Avoid unreviewed bulk changes.
