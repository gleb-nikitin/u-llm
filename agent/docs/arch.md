# Architecture

## Purpose
- LLM bridge adapter for the u-msg messaging ecosystem.
- Connects Claude (and later other LLM providers) as participants in u-msg chains.
- Speaks the u-msg message contract: chain writes, append semantics, notify/response_from participant routing.

## Stack
- TypeScript + Bun runtime.
- Agent SDK (`@anthropic-ai/claude-agent-sdk`) as primary Claude integration.
- Hono HTTP server on port 18180 (`u-llm.local`).

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
- Owns: LLM provider connections, session lifecycle, streaming relay, participant routing, role-based config.
- Does not own: protocol semantics, chain sequencing, idempotency, durable storage (u-msg/u-db own these).
- Does not own: human UI (u-msg-ui owns this).

## Multi-Participant Architecture
- `data/participants.json` defines N participants with explicit fields: `id`, `project`, `role`, optional `projectPath`, `rolePrompt`.
- Top-level config: `defaultModel` (full SDK model string, e.g. `claude-haiku-4-5-20251001`), `defaultEffort` (SDK effort option).
- Participant ID format: `{project}_{role}` (e.g. `u-msg_cto`). No model suffix, no parsing heuristics.
- `WsManager` maintains N independent WebSocket connections to u-msg, one per participant.
- Unified sessions: all participants get current/saved session slots. No ephemeral/persistent split.
  - `current`: active session ID, set on first interaction or fork.
  - `saved`: checkpoint slot. Save copies current → saved. Clear-via-meta (`msg.meta.clear=true`) clears current.
- Session control API: `GET /api/participants` (list with inline session state), `GET/POST /api/participants/:id/session` (save/delete-saved actions).
- Role prompts resolved from `data/prompts/{role}.md` files, with fallback chain: explicit field → role file → `default.md` → inline fallback.
- Each participant gets `systemPrompt: { type: 'preset', preset: 'claude_code', append: rolePrompt }`.
- Self-loop guard is per-participant (each participant ignores only its own messages).
- Structured message format: `# Summary\n...\n# Content\n...` in both directions. Summary written to u-msg, full content in session.

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
- `./agent/docs/case-agent-sdk.md` — Agent SDK programmatic integration reference.
- `./agent/docs/how-to-sdk-claude.md` — SDK session mechanics reference.
