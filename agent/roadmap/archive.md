# Completed Specs
# Append newest first.

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
