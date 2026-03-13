# Completed Specs
# Append newest first.

## Spec 018: SDK Upgrade (0.1.77 → 0.2.74)
- spec: `./agent/specs/018-sdk-upgrade.md`
- completed: 2026-03-13
- deliverables:
  - `src/sdk-query.ts` — added `allowDangerouslySkipPermissions: true` to queryOptions (required by SDK 0.2.x for bypassPermissions mode)
  - `package.json` — bumped `@anthropic-ai/claude-agent-sdk` from `0.1.77` to `0.2.74`
  - `bun.lock` — regenerated
  - `scripts/sdk-upgrade-check.ts` — new reusable validation script (static + live modes)
  - `agent/docs/claude-agent-sdk-cli-parity-settings.md` — section 11 updated with TypeScript SDK 0.2.x breaking change note
- result: 6/7 AC met. AC #6 (--live) unverified in agent shell (Claude Code CLI not in PATH); verify post-restart via real chain interaction. 49 tests passing, typecheck clean.

## Spec 017: Full SSE Stream — Forward All SDK Events
- spec: `./agent/specs/017-full-sse-stream.md`
- completed: 2026-03-13
- deliverables:
  - `src/sdk-query.ts` — `SdkEvent` type expanded: added `system`/`result` event types + `subtype`, `session_id`, `model`, `usage`, `stop_reason`, `num_turns`, `cost_usd`, `duration_ms` fields. System messages (init, compact_boundary) now emitted. Result message emitted with cost/turns/duration/model. `tool_result` reads from `block.content` (was `block.input` — bug). Truncation: tool_result 200→400, thinking removed. `token` events carry AssistantMessage metadata.
  - `src/sse/hub.ts` — `SSEEvent` type union extended with `system`/`result`. Interface extended with `subtype`, `usage`, `stop_reason`, `num_turns`. Standard detail mode filter now includes `result`.
- audit findings addressed: tool_result content field fixed (`block.content` not `block.input`); `turns`/`num_turns` coexistence confirmed intentional (different events: `done` vs `result`).
- result: All SDK events forwarded to SSE stream. UI gets full visibility: system lifecycle, per-query cost/turns/duration, model used, token usage, thinking content without truncation. 9/9 acceptance criteria met. 49 tests passing, typecheck clean.

## Spec 016: Fix Per-Participant Model/Effort Override Bug
- spec: `./agent/specs/016-fix-per-participant-model-effort.md`
- completed: 2026-03-12
- deliverables:
  - `src/participants/config.ts` — added `model`/`effort` to `RawParticipant`, `buildParticipants` now uses `p.model ?? defaultModel` and `p.effort ?? defaultEffort`
  - `src/participants/__tests__/config.test.ts` — replaced default-only test with 4 override tests (per-participant model, effort, fallback, mixed)
- also in this session:
  - `src/sdk-query.ts` — added `sandbox: { enabled: false }` for CLI parity
  - `src/umsg/handler.ts` — removed rolePrompt injection from systemPrompt.append (agents get role from CLAUDE.md/AGENTS.md)
  - `agent/docs/arch.md`, `agent/docs/kb.md` — updated to reflect role prompt and sandbox changes

## Spec 014: SSE Live Stream for Agent Observation
- spec: `./agent/specs/014-sse-live-stream.md`
- completed: 2026-03-11
- deliverables:
  - `src/sse/hub.ts` (new) — SSEHub singleton with subscriber registry, fan-out logic, detail mode filtering, debug logging, streaming enabled/disabled state
  - `src/routes/stream.ts` (new) — GET /api/stream (SSE stream), POST /api/stream/control (toggle streaming/detail mode), GET /api/stream/status (return state)
  - `src/sdk-query.ts` (modified) — added `onEvent` callback alongside `onDelta` for structured events (token, tool_use, tool_result, thinking)
  - `src/umsg/handler.ts` (modified) — emits start/done/error events to SSE hub, conditionally enables stream:true based on sseHub.isStreamingEnabled()
  - `src/server.ts` (modified) — mounts /api/stream route with control and status endpoints
- result: Real-time SSE streaming with global control. GET /api/stream returns SSE stream with participant filtering (?participant={id}), detail modes (minimal/standard/verbose), and debug logging (?log=on/off). POST /api/stream/control enables/disables streaming globally and changes detail mode — when disabled, handler.ts uses non-streaming sdkQuery (zero overhead). GET /api/stream/status returns {enabled, detail, clients, logging}. Streaming disabled by default. Events: start/token/tool_use/tool_result/thinking/done/error with detail-mode filtering. Multiple simultaneous clients, auto-cleanup on disconnect. Final messages to u-msg unchanged. All 46 tests passing, typecheck clean. All 23 acceptance criteria met.

## Spec 013: Watchdog Token Visibility
- spec: `./agent/specs/013-session-token-counter.md`
- completed: 2026-03-11
- deliverables:
  - `scripts/watchdog.sh` (rewritten) — auto-discovers SDK sessions from `participant-sessions.json`, shows file size + token count per participant, global stop with recovery prompt
  - `scripts/init-watchdog.ts` (rewritten) — simplified: `--max-size`, `--max-tokens`, `--interval` flags, no session path args
  - `data/watchdog.json` (new format) — `maxSizeMB`, `maxTokens`, `stopped`, `stoppedAt`, `stoppedReason`
  - `agent/human-watchdog.md` (rewritten) — operator instructions with launch commands and recovery prompt
- result: Watchdog monitors Claude Code SDK session JSONL files. Token count extracted from `usage` field in last assistant message (zero API calls). Dual limits: file size + token count. Global stop when any participant exceeds either limit. Recovery prompt auto-printed for agent handoff. 46 tests passing. CTO executed directly.

## Spec 012: Simple Watchdog
- spec: `./agent/specs/012-watchdog.md`
- completed: 2026-03-11
- deliverables:
  - `scripts/watchdog.sh` — bash monitoring loop, size checks every 30s
  - `scripts/init-watchdog.ts` — config initializer
  - `scripts/find-session.ts` — session file locator
  - `src/watchdog.ts` — `loadWatchdogConfig()`, `isSessionStopped()` with 5s cache
  - `src/umsg/handler.ts` — watchdog check before message processing
  - `data/watchdog.json` — runtime config
- result: Size-based watchdog live. Hard-stop on size limit exceeded. Superseded by spec 013 (token visibility, auto-discovery, dual limits).

## Spec 011: Per-Participant Model & Effort Overrides
- spec: `./agent/specs/011-per-participant-overrides.md`
- completed: 2026-03-11
- deliverables:
  - `data/participants.json` — per-participant `model` and `effort` fields
  - `src/participants/config.ts` — resolution: per-participant field → default
  - `src/umsg/handler.ts` — passes resolved model/effort to sdkQuery
- result: Per-participant model/effort overrides formalized. Different roles use different LLM capabilities. Config-driven, no code changes needed to switch models per role.

## Spec 010: Config Simplification
- spec: `./agent/specs/010-config-simplification.md`
- completed: 2026-03-10
- deliverables:
  - `data/participants.json` — new shape: `defaultModel` (full SDK string), `defaultEffort`, participants with explicit `id`, `project`, `role`, `projectPath`
  - `src/participants/config.ts` — removed `parseParticipantId`, `MODEL_MAP`, `MODEL_LETTERS`, `resolveModel`, `modelShort`. Added `project` and `effort` to `ParticipantConfig`. `buildParticipants` reads from explicit fields.
  - `src/sdk-query.ts` — added `effort` to `SdkQueryOptions`, passed to SDK query options
  - `src/umsg/handler.ts` — passes `config.effort` to sdkQuery
  - `src/routes/session.ts` — API returns `{id, role, project, session}` instead of `{id, role, model, session}`
  - `src/participants/__tests__/config.test.ts` — rewritten: `parseParticipantId` tests removed, explicit-field tests added
  - `src/participants/__tests__/session-store.test.ts` — updated: new IDs, new fixture shape, model-not-in-response test
  - `u-msg-ui/agent/inbox/adress-api.md` — updated: new response shape, new ID convention
  - `agent/docs/kb.md` — updated: new config description, new ID convention
- result: Config simplified. IDs now `{project}_{role}`. No parsing heuristics. Full SDK model strings. Effort option passed to SDK. CTO executed directly (small scope). 10/10 AC met. 47 tests passing.

## Spec 009: Unified Sessions & Structured Messages
- spec: `./agent/specs/009-unified-sessions-structured-messages.md`
- completed: 2026-03-10
- deliverables:
  - `src/participants/config.ts` — removed `sessionPolicy` + `PERSISTENT_ROLES`; added `projectPath` field with 3-level resolution (per-participant → defaults → fallback to project root)
  - `data/participants.json` — removed `sessionPolicy` from defaults; added `projectPath: "/Users/glebnikitin/work/code/u-llm"`
  - `src/umsg/message-format.ts` (new) — `formatIncoming(summary, content)`, `parseResponse(text)`, `FORMAT_INSTRUCTIONS` constant
  - `src/umsg/handler.ts` — unified session logic (all roles persistent); `msg.meta.clear` check; format incoming; parse response; write with summary; `cwd=config.projectPath`; `FORMAT_INSTRUCTIONS` prepended to role prompt
  - `src/umsg/client.ts` — `summary?: string` added to `WriteRequest`; `meta` typed as `Record<string,unknown>|null` in `StoredMessage`
  - `src/sdk-query.ts` — `cwd?: string` added to `SdkQueryOptions`; uses provided cwd or falls back to `join(import.meta.dir, "..")`
  - `src/routes/session.ts` — `sessionPolicy` removed; `delete-current` action removed; ephemeral guard removed; `session` always present for all participants
  - `src/participants/__tests__/config.test.ts` — updated: removed sessionPolicy tests, added projectPath tests
  - `src/participants/__tests__/session-store.test.ts` — updated: `resolveSessionOptions` tests use new 2+1 param signature; fixture participants drop sessionPolicy; API tests verify session always present
  - `src/umsg/__tests__/message-format.test.ts` (new) — 12 tests covering `formatIncoming`, `parseResponse`, `FORMAT_INSTRUCTIONS`
  - `u-msg-ui/agent/inbox/adress-api.md` — updated: no sessionPolicy, session always present
  - `u-msg-ui/agent/inbox/fork-api.md` — updated: delete-current removed, clear-via-meta documented
- result: All roles now get unified session management (current/saved/fork/fresh). Incoming messages formatted as `# Summary / # Content`. LLM responses parsed into summary + content. Summary written to u-msg explicitly. Clear-via-meta replaces delete-current API action. Auditor found 0 defects. 17/17 acceptance criteria met. 54 tests passing.

## Spec 008: Session Checkpoints for Persistent Roles
- spec: `./agent/specs/008-session-checkpoints.md`
- completed: 2026-03-09
- deliverables:
  - `src/participants/session-store.ts` (rewritten) — two-slot storage (currentSessionId + savedSessionId), auto-migration from old `sessionId` format
  - `src/umsg/handler.ts` (updated) — `resolveSessionOptions` extracted as exported pure function; fork-from-saved logic: current→resume, saved+no-current→fork, neither→fresh
  - `src/sdk-query.ts` (updated) — `forkSession` option added, passed through to SDK
  - `src/routes/session.ts` (new) — `GET /api/participants` (participant list), `GET /api/participants/:id/session` (slot state), `POST /api/participants/:id/session` (save/delete-current/delete-saved actions)
  - `src/server.ts` (updated) — new route mounted at `/api/participants`
  - `scripts/test-fork.ts` (new) — SDK fork verification script (requires live run)
  - `src/participants/__tests__/session-store.test.ts` (new) — 13 tests: 7 store, 4 handler logic, 2 participant list endpoint
  - `/Users/glebnikitin/code/u-msg-ui/agent/inbox/fork-api.md` (new) — UI integration contract
- result: Persistent roles have save/restore checkpoint mechanism. Two-slot store migrates old format automatically. resolveSessionOptions is tested against the real handler function. Audit found 3 issues — all fixed (test coverage gap, non-atomic save documented, backupStore async bug). 14/14 acceptance criteria met.

## Spec 007: Role Prompts, Parsing Hardening, Full Content, Tests
- spec: `./agent/specs/007-role-prompts-parsing-tests.md`
- completed: 2026-03-09
- deliverables:
  - `data/prompts/{default,cto,exec,audit,secretary}.md` (new) — role prompt files, one per role
  - `data/participants.json` (updated) — `rolePrompt` is now a filename; `defaults.rolePrompt` removed (dead config)
  - `src/participants/config.ts` (rewritten) — hardened `parseParticipantId` (returns undefined for missing segments), `loadRolePrompt` with 4-step fallback chain returning `{prompt, source}`, `buildParticipants` extracted for testability
  - `src/umsg/handler.ts` (updated) — removed summary truncation for persistent roles; all participants get full content
  - `src/participants/__tests__/config.test.ts` (new) — 20 tests: 9 parsing, 6 prompt loading, 5 buildParticipants
  - `package.json` (updated) — added `"test": "bun test"` script
- result: Role prompts externalized to files. Parser handles all edge cases (empty, 1-segment, 2-segment ambiguous, 3+ without model). Full content for all participants. Audit found 3 defects (missing loadParticipants tests, misleading log, dead config field) — all fixed before acceptance. 10/10 acceptance criteria met.

## Spec 006: Multi-Participant Session Patterns
- spec: `./agent/specs/006-multi-participant-sessions.md`
- completed: 2026-03-09
- deliverables:
  - `data/participants.json` (new) — runtime config, editable without rebuild
  - `src/participants/config.ts` (new) — config loader, `parseParticipantId()`, model mapping, session policy inference
  - `src/participants/session-store.ts` (new) — per-participant session persistence for persistent roles + legacy file archival
  - `src/umsg/ws-manager.ts` (new) — multi-WS connection manager, independent reconnect per participant
  - `src/umsg/handler.ts` (rewritten) — role-based routing, per-participant self-loop guard, ephemeral vs persistent session logic, cost logging
  - `src/umsg/client.ts` (modified) — `writeMessage()` and `markRead()` accept `participantId` parameter
  - `src/umsg/config.ts` (modified) — removed global `UMSG_PARTICIPANT_ID` and `UMSG_WS_URL`
  - `src/sdk-query.ts` (extended) — `systemPrompt`, `persistSession`, `maxTurns`, `permissionMode`, `costUsd`
  - `src/server.ts` (rewired) — uses `WsManager` + participant config, health shows per-participant status
  - `src/routes/umsg.ts` (rewritten) — factory pattern `createUmsgRoute(wsManager)`, reconnect endpoint restored
- result: Service starts N independent WebSocket connections from `data/participants.json`. Each participant has its own model, system prompt, and session policy. Ephemeral roles (exec, audit) get fresh sessions every message. Persistent roles (cto, secretary) resume across all chains. Cost logged per query. Old session files archived to `.bak`. Audit passed with 2 findings fixed (reconnect endpoint restored, circular import eliminated). 12/12 acceptance criteria met.

## Spec 005: u-msg WebSocket Integration
- spec: `./agent/specs/005-umsg-integration.md`
- completed: 2026-03-09
- deliverables: `src/umsg/ws.ts`, `src/umsg/handler.ts`, `src/umsg/client.ts`, `src/umsg/config.ts`, `src/umsg/session-map.ts`, `src/routes/umsg.ts`, `src/server.ts` (modified)
- result: u-llm is a live participant in u-msg chains. WebSocket connected, messages received and responded. Chain→session mapping for multi-turn. Always-on at u-llm.local:18180 via launchd.

## Spec 004: HTTP Service + Always-On Deploy
- spec: `./agent/specs/004-http-service-deploy.md`
- completed: 2026-03-09
- deliverables: `src/server.ts` (new), `src/routes/query.ts` (new), `src/routes/sessions.ts` (new), `src/sdk-query.ts` (onDelta), `src/cli-headless.ts` (onDelta), `package.json` (dev/start scripts, hono dep), `/Users/glebnikitin/work/server/nginx/conf.d/u-llm.conf`, `/Users/glebnikitin/work/server/scripts/start-u-llm-dev.sh`, `/Users/glebnikitin/work/server/launchd/com.gleb.work.server.u-llm.plist`, symlink at server/projects/u-llm
- result: Hono server on 18180. /health, /api/query (stream+non-stream), /api/sessions. SSE streaming via ReadableStream + onDelta callback. nginx routed via u-llm.local. Launchd service installed and running. 9/10 acceptance criteria passed (10 blocked by /etc/hosts needing sudo).

## Spec 003: Session Management + Streaming
- spec: `./agent/specs/003-sessions-streaming.md`
- completed: 2026-03-09
- deliverables: `src/session-store.ts` (new), `src/sdk-query.ts` (modified), `src/cli-headless.ts` (modified), `src/cli.ts` (modified), `.gitignore` (modified)
- result: Session persistence via `./data/sessions.json`. `--resume <id>`, `--continue`, `--sessions`, `--stream` flags live. SDK and CLI paths both support resume and streaming. 3 bugs found in audit and fixed: missing `includePartialMessages` in SDK stream path, empty sessionId guard, and `--verbose` required for `stream-json + --print`. 8/8 acceptance criteria passed.

## Spec 002: CLI Headless Integration
- spec: `./agent/specs/002-cli-headless.md`
- completed: 2026-03-09
- deliverables: `src/cli-headless.ts` (new), `src/cli.ts` (modified)
- result: CLI subprocess wrapper for `claude -p` with stream-json output. `--via cli` flag routes through subprocess path. 6/6 acceptance criteria passed.

## Spec 001: Project Skeleton + Agent SDK Basic
- spec: `./agent/specs/001-skeleton-sdk-basic.md`
- completed: 2026-03-09
- deliverables: `package.json`, `tsconfig.json`, `src/cli.ts`, `src/sdk-query.ts`
- result: CLI tool sends prompts to Claude via Agent SDK. One-shot query with `--model` flag. All 7 acceptance criteria passed.
