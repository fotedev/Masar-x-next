# Contracts: 004 — Multi-Platform Expansion

This directory describes the cross-platform interface contracts that the three apps (web, desktop, mobile) agree to when they share code through `packages/shared/`. Each contract is documented as a standalone file so it can be referenced from the type definitions, the build pipeline, and the test suite independently.

The contracts in this directory are **not API contracts for the product's public surface** — those live in the Supabase schema and the Edge Functions. These are **internal contracts between the apps and the shared package**.

## Files

- **[supabase-client.md](./supabase-client.md)** — How each runtime gets a Supabase client, and what each client is allowed to do.
- **[i18n-messages.md](./i18n-messages.md)** — How translation messages are shared across runtimes, and the contract for adding a new key.
- **[ai-boundary.md](./ai-boundary.md)** — How the AI provider key stays server-side, and what each client is and is not allowed to do.

## Why these are contracts, not just helpers

Each of these is a **security boundary** as well as a code-sharing convenience. If a future contributor changes one of them, they have changed the security posture of the product. The contracts make the security implications explicit and reviewable.

## Scope of these contracts

These contracts cover the cross-platform code in `packages/shared/`. They do not restate the security mechanisms that are enforced at the Supabase project / policy layer, specifically:

- **Row Level Security (RLS)** — spec FR-018. Enforced by Postgres policies on every user-data table. The client code's job is to make authorized requests and to never bypass RLS (for example, by calling a service-role Postgres function); the policy itself is server-side.
- **Rate limits** — spec FR-019. Enforced by the existing rate-limit infrastructure (password reset, Edge Functions). The client contracts require the apps to handle rate-limit responses with user-friendly messaging; the limit itself is server-side.

A reader of these contracts should assume that server-side enforcement is happening where the spec says it is, even when the contract does not restate it. If you are reviewing the plan and do not see RLS or rate limits in the contracts, that is intentional — they are enforced at the Supabase layer, not duplicated here.

## Reviewing changes to a contract

A change to any contract in this directory is treated as a **breaking change** to all three apps, even if the change looks small. The PR description must:

1. State which app(s) are affected.
2. State whether the change is backwards-compatible (additive, no removals).
3. If the change is in `supabase-client.md` or `ai-boundary.md`, state whether the security posture is unchanged.

A change that weakens the security posture (e.g., adds a way for the client to call the AI provider directly, or adds a way to ship the service role key to the bundle) MUST be rejected, not amended.
