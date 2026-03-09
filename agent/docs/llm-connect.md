# LLM Connection Reference

## Architecture Decision

For our service (custom UI where we monitor session messages and reply in-app), the primary integration pattern is:
**Claude Agent SDK + Streaming Input Mode + persisted `session_id` + `resume`.**

Why:
1. Streaming Input Mode is the recommended model for interactive applications.
2. The SDK provides session lifecycle primitives — continue conversations reliably with `resume`.
3. Real-time UX via partial message streaming (`include_partial_messages`), allowing token-level rendering in our UI.
4. Branch conversations safely using `forkSession` when needed.

### Key Implementation Behaviors
1. On session start, capture and persist `session_id` from system/init metadata.
2. For each user reply, route to the correct active session and call with `resume: <session_id>`.
3. For live output, process `stream_event` messages and extract `content_block_delta` where `delta.type == text_delta`.
4. Persist both raw events and normalized message records for replay, audit, and debugging.
5. Handle reconnection and retries idempotently (avoid duplicate assistant turns on network retry).
6. Track session branch lineage if using `forkSession` (parent_session_id -> child_session_id).
7. Surface operational system messages (init, compact boundary, result) in logs/telemetry, not only assistant text.

### Architecture Implications
1. Keep a Session Registry (session_id, owner, status, last_event_at, parent_session_id).
2. Keep a Message/Event Store (ordered events + rendered messages).
3. Provide a streaming transport to UI (SSE/WebSocket) for partial updates.
4. Implement a command endpoint for replies that maps user -> session -> SDK call.
5. Add observability around latency, turn completion, refusal/error rates, and retry outcomes.

### What NOT to Use as Primary
1. **Messages API as core session mechanism** — stateless for multi-turn, must store and resend full history each turn. Better as fallback for simple non-session chat.
2. **TypeScript SDK V2 preview as production foundation** — marked unstable preview. Prefer stable V1 SDK path.

### Roadmap Guardrails
1. MVP: single-session resume + streaming text deltas + basic persistence.
2. Next: branching (`forkSession`), replay, and admin diagnostics.
3. Later: multi-tenant controls, stronger SLAs, and advanced observability.

## Auth (Claude Max Subscription)

- Max subscription authenticates via OAuth browser flow (`claude` CLI login).
- No API key needed for personal use.
- SDK/CLI inherit local OAuth session.
- Restriction: distributing products using claude.ai auth to third parties requires Anthropic approval — personal/internal use is fine.

## Models Available

| Alias | Model | Context | Use for |
|-------|-------|---------|---------|
| `opus` | Opus 4.6 | 200K (1M beta) | Deep reasoning, architecture, audit |
| `sonnet` | Sonnet 4.6 | 200K (1M beta) | Default workhorse, execution |
| `haiku` | Haiku 4.5 | 200K | Mechanical tasks, preprocessing |

Switch: `--model opus|sonnet|haiku` (CLI) or model option in SDK.
1M context requires beta header `context-1m-2025-08-07`.

## Case Files (Lazy-Load)

- `./case-cli-headless.md` — CLI subprocess integration: one-shot, streaming, multi-turn, system prompts, tools, subagents, JSONL output.
- `./case-agent-sdk.md` — Agent SDK programmatic integration: TS/Python query, sessions, MCP tools, subagents, result types.
- `./case-orchestration.md` — Multi-agent patterns, token efficiency, CTO context protection, integration architecture.

## Local Docs (Deep Reference)

- `/Users/glebnikitin/disk/kb/claude/agent-sdk--sessions.md`
- `/Users/glebnikitin/disk/kb/claude/agent-sdk--streaming-output.md`
- `/Users/glebnikitin/disk/kb/claude/agent-sdk--typescript-v2-preview.md`
- `/Users/glebnikitin/disk/kb/claude/agent-sdk--typescript.md`
- `/Users/glebnikitin/disk/kb/claude/agent-sdk--python.md`
- `/Users/glebnikitin/disk/kb/claude/api--messages.md`

## Official Docs Index

| Topic | URL |
|-------|-----|
| CLI reference | https://docs.anthropic.com/en/docs/claude-code/cli-reference |
| Headless mode | https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-headless |
| Agent SDK overview | https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-overview |
| SDK TypeScript | https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript |
| SDK Python | https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-python |
| Sessions | https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-sessions |
| Permissions | https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-permissions |
| Custom tools | https://docs.anthropic.com/en/docs/claude-code/sdk/custom-tools |
| Subagents | https://docs.anthropic.com/en/docs/claude-code/sdk/subagents |
| MCP servers | https://docs.anthropic.com/en/docs/claude-code/mcp |
| Streaming output | https://docs.anthropic.com/en/docs/claude-code/sdk/streaming-output |
| Session management | https://docs.anthropic.com/en/docs/claude-code/sdk/session-management |
| Messages API | https://docs.anthropic.com/en/api/messages#create-a-message |
