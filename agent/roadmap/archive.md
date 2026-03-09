# Completed Specs
# Append newest first.

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
