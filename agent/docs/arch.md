# Architecture

## Purpose
- LLM bridge adapter for the u-msg messaging ecosystem.
- Connects Claude (and later other LLM providers) as participants in u-msg chains.
- Speaks the u-msg message contract: chain writes, append semantics, notify/response_from participant routing.

## Stack
- TypeScript + Bun runtime.
- Agent SDK (`@anthropic-ai/claude-agent-sdk`) as primary Claude integration.
- CLI headless mode as secondary/scripting integration.
- Will connect to u-msg backend (Bun + Hono, port 18080 / `chain-api.u-msg.local`).

## Ecosystem

```
u-db (Python, DuckDB)         — durable storage
  ↑
u-msg (TS, Bun/Hono)          — chain-based messaging backend, protocol-first
  ↑
  ├── u-msg-ui (Vite+TS)      — human-facing UI
  └── u-llm (THIS PROJECT)    — LLM bridge adapters
```

## Boundaries
- Owns: LLM provider connections, session lifecycle, streaming relay, agent orchestration.
- Does not own: protocol semantics, chain sequencing, idempotency, durable storage (u-msg/u-db own these).
- Does not own: human UI (u-msg-ui owns this).

## Deployment
- Always-on service via server workspace (`/Users/glebnikitin/work/server/`).
- nginx in Docker (host-based routing, `*.local` domains) + launchd for process management.
- Pattern: `nginx/conf.d/<project>.conf` + `scripts/start-<project>-dev.sh` + `launchd/*.plist`.

## Sibling Projects
- `u-msg-ui` (`/Users/glebnikitin/work/code/u-msg-ui/`) — donor for TS patterns, Bun setup, u-msg backend integration.
- `u-msg` (`/Users/glebnikitin/work/code/u-msg/`) — backend protocol authority.
- `u-db` (`/Users/glebnikitin/work/code/u-db/`) — storage layer.

## Key Files
- `./agent/docs/llm-connect.md` — LLM connection index (architecture decision, auth, models, doc links).
- `./agent/docs/case-cli-headless.md` — CLI subprocess integration reference.
- `./agent/docs/case-agent-sdk.md` — Agent SDK programmatic integration reference.
- `./agent/docs/case-orchestration.md` — Multi-agent orchestration patterns.
