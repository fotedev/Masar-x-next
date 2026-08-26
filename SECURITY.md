# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Report it privately through [GitHub's private vulnerability reporting](https://github.com/fotedev/Masar-x-next/security/advisories/new) on this repository — the private source repository. Do **not** file security reports against [`fotedev/masarx-releases`](https://github.com/fotedev/masarx-releases); that repository publishes build artifacts only and contains no code to review. Include:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- Affected surfaces (web / desktop / mobile / Edge Functions)

You can expect an initial response within a few business days. We will credit reporters in the fix release unless asked otherwise.

## Security model

Masar X splits trust by runtime. The guarantees below hold across all client apps (web, desktop, mobile):

| Guarantee | Mechanism |
| ----------- | ----------- |
| Row-level data isolation | Supabase Row Level Security policies on every table |
| Service-role key stays server-side | Only Vercel server environment holds it; the [shared-client contract](./specs/004-multi-platform-expansion/contracts/supabase-client.md) forbids it in any client context |
| AI provider keys stay server-side | Provider SDKs and endpoint strings are confined to Edge Functions and `packages/shared`; enforced by ESLint restricted imports and CI endpoint grep ([AI boundary contract](./specs/004-multi-platform-expansion/contracts/ai-boundary.md)) |
| No secrets in source or artifacts | gitleaks scans both the source tree and post-build artifacts; push hook blocks commits containing secrets |
| Client-visible variables are safe by construction | Only `NEXT_PUBLIC_*` values are bundled into client JS; see `.env.example` scope comments |

## Enforcement in CI

These checks run on every push and pull request (see `.github/workflows/ci.yml`):

1. **gitleaks — source tree** (`required`)
2. **ESLint restricted imports** — blocks direct `openai` / `@anthropic-ai/sdk` usage outside allowed contexts (`error`)
3. **AI provider endpoint grep** (`required`)
4. **gitleaks — built artifacts**, scanning the post-`next build` output (`required`)

## Scope

- In scope: the web app, desktop app, mobile app, Supabase schema/policies, Edge Functions, and repository workflows.
- Out of scope: volumetric attacks (DoS), social engineering, and issues requiring a compromised developer machine.

## Supported configurations

The web app deployed from `main` is the only supported configuration. Desktop and mobile builds are pre-release while under active development.
