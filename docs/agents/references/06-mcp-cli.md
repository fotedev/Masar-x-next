# MCP and CLI quick map

| Tool | Use for | Notes |
|---|---|---|
| `vercel` CLI / MCP | deploys, env, logs, marketplace | Prefer MCP for tool-call style; CLI for scripts/CI |
| `gh` CLI / MCP | PRs, issues, repo ops, GitHub API | PAT auth on the local side |
| `supabase` CLI / MCP | schema migrations, edge fns, ad-hoc SQL | Locked to project ref `jcufigozkhxazjbwhjjm` |
| `cloudflare-api` MCP | entire CF API via Code Mode (~1k tokens) | **NOT loaded in MiniMax Code** — see [01-gotchas.md](./01-gotchas.md) §13 |
| `wrangler` (fallback) | Cloudflare when MCP unavailable | — |

At session start, run `mavis mcp list` to confirm what's actually loaded — `cloudflare-api` etc. are NOT in MiniMax Code by default.

**Back to:** [AGENTS.md](../../../AGENTS.md)
