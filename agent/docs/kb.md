# Knowledge Base

## Lazy-Load Index
- `./agent/docs/arch.md` — architecture, stack, boundaries, ecosystem map.
- `./agent/docs/run.md` — run/build/test commands.
- `./agent/docs/llm-connect.md` — LLM connection index: architecture decision, auth, models, doc links.
- `./agent/docs/case-cli-headless.md` — CLI subprocess integration (one-shot, streaming, multi-turn, subagents).
- `./agent/docs/case-agent-sdk.md` — Agent SDK integration (TS/Python query, sessions, MCP tools, subagents).
- `./agent/docs/case-orchestration.md` — Multi-agent patterns, token efficiency, CTO context protection.
- `./agent/docs/umsg-api.md` — u-msg API reference: all endpoints, consumer pattern for LLMs, message types. Load when agents need to use chains.
- `./agent/docs/case-umsg-contract.md` — u-msg integration contract: full types, WebSocket, participant model, source refs. Deep reference.
- `./agent/docs/how-to-sdk-claude.md` — SDK session mechanics: resume, fork, system prompt, options mutability.
- `./agent/docs/mcp-routing-contract.md` — MCP routing tool design: route_message, in-process SDK MCP, workflow automation, open questions.
- `./agent/docs/u-llm-sdk-session-spec.md` — HISTORICAL: brainstorm decisions that led to specs 006–008. Kept for reference, not maintained.
- `./agent/roadmap/intent.md` — global goals, current phase, direction decisions.

## Donor Projects
- `u-msg-ui` (`/Users/glebnikitin/work/code/u-msg-ui/`) — TS patterns, Bun setup, u-msg backend integration. Indexed in code-indexer.
- `u-msg` (`/Users/glebnikitin/work/code/u-msg/`) — backend protocol, message contract. Indexed in code-indexer.

## Deep Reference (kb disk)
- `/Users/glebnikitin/disk/kb/claude/` — downloaded Claude docs (7889 chunks indexed as `kb-claude` in code-indexer).
- `/Users/glebnikitin/disk/u-llm/claude-sdk-cli-ssh.md` — source context file for this project's LLM connection docs.

## Spec Index
- Specs 001–021 complete. Details in `./agent/roadmap/archive.md`.
- `./agent/specs/001-skeleton-sdk-basic.md` — project skeleton + Agent SDK one-shot query.
- `./agent/specs/002-cli-headless.md` — CLI subprocess wrapper, `--via cli` flag.
- `./agent/specs/003-sessions-streaming.md` — session persistence, resume, streaming partial output.
- `./agent/specs/004-http-service-deploy.md` — Hono HTTP server, SSE streaming, nginx + launchd always-on.
- `./agent/specs/005-umsg-integration.md` — u-msg WebSocket integration, chain→session mapping, LLM participant.
- `./agent/specs/006-multi-participant-sessions.md` — N participants, role-based routing, ephemeral/persistent sessions, per-participant config.
- `./agent/specs/007-role-prompts-parsing-tests.md` — role prompts from files, parsing hardening, full content for all, test coverage.
- `./agent/specs/008-session-checkpoints.md` — two-slot session store, fork-from-saved, session control API.
- `./agent/specs/009-unified-sessions-structured-messages.md` — unified message format, `seq` identifiers, fetchMessageBySeq API.
- `./agent/specs/010-config-simplification.md` — simplified participant IDs (`{project}_{role}`), explicit `defaultModel`/`defaultEffort`, removed `parseParticipantId`.
- `./agent/specs/011-per-participant-overrides.md` — per-participant model/effort overrides, fine-grained role capability control.
- `./agent/specs/012-watchdog.md` — size-based session watchdog, hard-stop mechanism. Superseded by 013.
- `./agent/specs/013-session-token-counter.md` — watchdog with token visibility, auto-discovery, dual limits (size + tokens).
- `./agent/specs/014-sse-live-stream.md` — SSE live stream for agent observation, detail modes, stream control API.
- `./agent/specs/020-multi-session-store.md` — session save/checkpoint: active (auto-managed) + saved[] (user checkpoints), fork via SDK forkSession.
- `./agent/specs/021-handoff-routing-dedup.md` — handoff routing (# Handoff → role→participant), send_message dedup, watchdog multi-project, format.md minimal.

## Key Runtime Config
- `data/participants.json` — source of truth: `defaultModel` (full SDK string), `defaultEffort` (`low|medium|high|max`), participants with explicit `id`, `project`, `role`, optional per-participant `model` and `effort` overrides, `projectPath`. rolePrompt field is optional filename.
  - Model/effort resolution: per-participant field (if present) → default (if not present)
- `data/prompts/{role}.md` — role prompt files. **Dead code**: loaded by config.ts but no longer injected into SDK queries. Kept for potential fallback. Participants get role context from project CLAUDE.md/AGENTS.md instead.
- `data/prompts/format.md` — FORMAT_INSTRUCTIONS appended to all system prompts. Minimal: 2 lines (markdown directive + architectural principle). Role-specific format delivered via briefing sessions.
- `data/participant-sessions.json` — V4 session state per participant: `{ active: string | null, saved: SavedSession[] }`. Active is auto-managed by handler; saved[] only populated by explicit user save. Auto-migrates from V1/V2/V3 formats.
- Participant ID convention: `{project-name}_{role}` (e.g. `u-msg_cto`, `u-msg_exec`). Project and role are explicit config fields — ID is an opaque lookup key.

## API Endpoints
- `GET /health` — service health + per-participant WS connection status
- `GET /api/participants` — participant list with `id`, `role`, `project`, `session` (no model in response)
- `GET /api/participants/:id/session` — session state: `{ participantId, active, saved: SavedSession[] }`
- `POST /api/participants/:id/sessions/save` — save current active to saved[] checkpoint
- `PUT /api/participants/:id/sessions/active` — set active pointer (must be in saved[] or null)
- `PATCH /api/participants/:id/sessions/:sid` — rename saved session label
- `DELETE /api/participants/:id/sessions/:sid` — remove from saved[]
- `GET /api/umsg/status` — WS connection status
- `POST /api/umsg/reconnect` — reconnect all WS connections
- `POST /api/query` — direct SDK query (not used by u-msg flow)
- `GET /api/sessions` — legacy session list
- `GET /api/stream` — SSE live stream (optional `?participant`, `?detail=minimal|standard|verbose`)
- `POST /api/stream/control` — toggle streaming on/off, change detail mode
- `GET /api/stream/status` — streaming state (enabled, detail, clients, logging)

## Known Debt
- Participant session store is flat JSON — no locking; concurrent writes could corrupt.
- Handler forks (forkSession: true) when active is in saved[] — checkpoint immutable, no shared JSONL mutation.
- `--dangerously-skip-permissions` still in cli-headless.ts.
- `/etc/hosts` entry for `u-llm.local` must be added manually (requires sudo): `127.0.0.1 u-llm.local`

## u-msg API
Full reference: `./agent/docs/umsg-api.md`. Deep types/contract: `./agent/docs/case-umsg-contract.md`.

## Runtime Logs (data/)
- `data/sdk-errors.log` — empty text / failed SDK queries (timestamp, participant, chain, turns, cost)
- `data/discarded-replies.log` — notify-only replies that were trashed (timestamp, participant, chain, first 200 chars)
- `data/sse-debug.log` — SSE events when debug logging enabled (`?log=on`)

## Watchdog
- `data/watchdog.json` — runtime config: `maxSizeMB`, `maxTokens`, `stopped`, `stoppedAt`, `stoppedReason`
- `scripts/watchdog.sh` — launch in terminal, auto-discovers sessions from `participant-sessions.json`
- `src/watchdog.ts` — `isSessionStopped()` checks `data/watchdog.json` stopped flag (5s cache)
- `agent/human-watchdog.md` — operator instructions (launch, recovery prompt)
- Token extraction: last assistant message's `usage` field in Claude Code SDK JSONL (zero API calls)
- Session JSONL path: `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`

## Session Handoff
- date: 2026-03-15
- phase: Self-orchestration loop validated.
- what changed: Spec 021 closed. Handler routes via `# Handoff` (role→participant resolution). send_message dedup: handler skips auto-capture when agent posts directly to chain. Watchdog monitors all projects. format.md minimal (2 lines). u-au project bootstrapped with 6 participants — first CTO→Find→CTO loop completed via chains. Briefing sessions replace role prompt files.
- what's live: Service at u-llm.local:18180. 11 participants (u-llm + u-au). Handoff routing + dedup live.
- risks: Flat JSON store (no write locking). SSE ephemeral. response_from → act_by rename pending across all systems.
- next: act_by field rename. CLI fallback path for agent quality. Chains-as-documentation rollout.
