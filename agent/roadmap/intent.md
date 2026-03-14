# Roadmap Intent

## Global Goals
- Vision: Symbiont communication system — human ↔ LLM ↔ LLM ↔ services.
- Intent-first: LLMs must understand where we're heading to define success themselves.
- Backend: LLM-first. Frontend: human-first.
- Ecosystem: u-db (database), u-msg (protocol), u-msg-ui (human layer), u-llm (LLM bridge).
- Scope: all four projects — we give them tasks to get better.

## Provider Order
1. Claude (primary, current focus)
2. OpenAI (second)
3. Ollama / local LLMs (last)

## What's Done
Specs 001–014 complete. Foundation through observability.
- HTTP service always-on at u-llm.local:18180 (launchd + nginx)
- Multi-participant WS connections, role-based routing, config-driven
- Role prompts externalized to `data/prompts/{role}.md`
- Unified sessions: all roles get current/saved/fork/fresh
- Structured message format: `# Summary / # Content` in/out
- Clear-via-meta: fork from saved checkpoint (not fresh start)
- Session control API: `GET /api/participants`, `GET/POST /api/participants/:id/session`
- Save nulls current → next message forks from saved → frozen checkpoint preserved
- Config: explicit project/role fields, full model strings, per-participant model/effort overrides
- Watchdog: token counting from SDK JSONL, dual limits (size+tokens), global stop, auto-discovery
- SSE live stream: real-time agent observation (start/token/tool_use/tool_result/thinking/done/error), detail modes (minimal/standard/verbose), stream control API, disabled by default
- SDK parity: settingSources:['project'] (loads CLAUDE.md), code-indexer MCP, FORMAT_INSTRUCTIONS externalized
- Response routing: only response_from writes to chain, notify-only receives into session but reply discarded (logged to data/discarded-replies.log)
- u-msg API reference doc: `agent/docs/umsg-api.md`
- 46 tests passing
- Dogfooding validated: secretary, executor, auditor roles work end-to-end through u-msg-ui

Details: `./agent/roadmap/archive.md`

## What's Next

### Phase: Dogfood & Observability (wrapping up)
- ~~Switch to our own protocol for CTO ↔ executor ↔ auditor communication~~ done
- ~~Test interface: broadcast processing status (thinking, turn N, cost) for humans and LLMs~~ done (SSE stream)
- ~~Watchdog: detect hung SDK queries, alert sender when response takes too long~~ done
- u-msg-ui rendering of SSE stream (subscribe to events, display live progress)

### Phase: Chain Intelligence
- Make conversation chains searchable: export DB content to files, index via code-indexer (vector + exact search)
- CTO session as saved participant: record session ID, resume via protocol, remove human permission blocking
- Dynamic context assembly per participant

### Phase: Participant Management
- Address Book — dynamic participant registration, discovery
- MCP server for u-msg — native chain access for LLM participants

### Phase: Automated Orchestration
- COO agent manages CTO → Executor → Auditor → Git cycle
- Dynamic context assembly, chain protocol

## Direction Rules
- Keep specs concise, implementation-oriented, and testable.
- Keep context files compact and suitable for no-history sessions.
- u-msg-ui is the donor project for TS patterns, build setup, and backend integration code.
- u-msg backend is the protocol authority — u-llm speaks its message contract.
- Eat your own dogfood: use the system to build the system.

## Decisions
<!-- Log direction-changing decisions. Format: date | decision | rationale -->
- 2026-03-09 | Primary integration: Agent SDK + Streaming + session persistence | Recommended model for interactive applications with session lifecycle primitives.
- 2026-03-09 | Stack: TypeScript + Bun | Matches u-msg-ui donor, shared ecosystem.
- 2026-03-09 | Auth: Claude Max OAuth (no API key) | Personal/internal use, SDK/CLI inherit local session.
- 2026-03-09 | Multi-participant via config file, not env vars | `data/participants.json` is sole source of truth. Editable without rebuild.
- 2026-03-10 | Unified sessions — all roles persistent | Even ephemeral roles need 2-3 resumes per task. sessionPolicy removed. Clear-via-meta replaces delete-current. Saved sessions as "briefings" for all roles.
- 2026-03-09 | Session checkpoints via HTTP API, not u-msg control messages | Keep messaging clean. Separate control plane.
- 2026-03-09 | Two-slot session model (current + saved) | ~~Simple, covers save/fork/discard.~~ Superseded by spec 020: active + saved[] (N checkpoints).
- 2026-03-14 | Active/saved separation: handler never populates saved[] | saved[] only from explicit POST /sessions/save. Handler auto-manages active pointer. Checkpoints immutable via SDK forkSession:true.
- 2026-03-14 | Clear + saved → fork from checkpoint; clear + no saved → fresh | User controls fork-from via checkbox (PUT /sessions/active). Clear Memory respects selection.
- 2026-03-10 | Ecosystem scope: u-db, u-msg, u-msg-ui, u-llm | All four projects in scope for improvement tasks.
- 2026-03-11 | response_from = sole responder, notify = observe only | Only response_from participant writes reply to chain. Notify-only participants receive message into session (context stays current) but reply is discarded and logged. Prevents N agents all replying.
- 2026-03-11 | SDK parity: settingSources + code-indexer MCP | sdkQuery now loads CLAUDE.md via settingSources:['project'] and provides code-indexer MCP (type:http) to all participants. Matches CLI behavior.
