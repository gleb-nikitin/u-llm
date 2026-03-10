# Knowledge Base

## Lazy-Load Index
- `./agent/docs/arch.md` — architecture, stack, boundaries, ecosystem map.
- `./agent/docs/run.md` — run/build/test commands.
- `./agent/docs/llm-connect.md` — LLM connection index: architecture decision, auth, models, doc links.
- `./agent/docs/case-cli-headless.md` — CLI subprocess integration (one-shot, streaming, multi-turn, subagents).
- `./agent/docs/case-agent-sdk.md` — Agent SDK integration (TS/Python query, sessions, MCP tools, subagents).
- `./agent/docs/case-orchestration.md` — Multi-agent patterns, token efficiency, CTO context protection.
- `./agent/docs/case-umsg-contract.md` — u-msg integration contract: API endpoints, message types, WebSocket, participant model.
- `./agent/docs/how-to-sdk-claude.md` — SDK session mechanics: resume, fork, system prompt, options mutability.
- `./agent/docs/u-llm-sdk-session-spec.md` — HISTORICAL: brainstorm decisions that led to specs 006–008. Kept for reference, not maintained.
- `./agent/roadmap/intent.md` — global goals, current phase, direction decisions.

## Donor Projects
- `u-msg-ui` (`/Users/glebnikitin/work/code/u-msg-ui/`) — TS patterns, Bun setup, u-msg backend integration. Indexed in code-indexer.
- `u-msg` (`/Users/glebnikitin/work/code/u-msg/`) — backend protocol, message contract. Indexed in code-indexer.

## Deep Reference (kb disk)
- `/Users/glebnikitin/disk/kb/claude/` — downloaded Claude docs (7889 chunks indexed as `kb-claude` in code-indexer).
- `/Users/glebnikitin/disk/u-llm/claude-sdk-cli-ssh.md` — source context file for this project's LLM connection docs.

## Spec Index
- Specs 001–009 complete. Details in `./agent/roadmap/archive.md`.
- `./agent/specs/001-skeleton-sdk-basic.md` — project skeleton + Agent SDK one-shot query.
- `./agent/specs/002-cli-headless.md` — CLI subprocess wrapper, `--via cli` flag.
- `./agent/specs/003-sessions-streaming.md` — session persistence, resume, streaming partial output.
- `./agent/specs/004-http-service-deploy.md` — Hono HTTP server, SSE streaming, nginx + launchd always-on.
- `./agent/specs/005-umsg-integration.md` — u-msg WebSocket integration, chain→session mapping, LLM participant.
- `./agent/specs/006-multi-participant-sessions.md` — N participants, role-based routing, ephemeral/persistent sessions, per-participant config.
- `./agent/specs/007-role-prompts-parsing-tests.md` — role prompts from files, parsing hardening, full content for all, test coverage.
- `./agent/specs/008-session-checkpoints.md` — two-slot session store, fork-from-saved, session control API.

## Key Runtime Config
- `data/participants.json` — source of truth for active participants (id, model override, sessionPolicy override). rolePrompt field is optional filename.
- `data/prompts/{role}.md` — role prompt files. Resolution: explicit field → `{role}.md` → `default.md` → inline fallback.
- `data/participant-sessions.json` — two-slot session state per persistent participant (currentSessionId + savedSessionId). Auto-migrates from legacy format.
- Participant ID convention: `{project}-{role}-{model}` (e.g. `umsg-cto-o`, `umsg-exec-s`). Model segment: `o`=opus, `s`=sonnet, `h`=haiku.

## API Endpoints
- `GET /health` — service health + per-participant WS connection status
- `GET /api/participants` — participant list with role, model, inline session state (no sessionPolicy)
- `GET /api/participants/:id/session` — session slot state (current + saved)
- `POST /api/participants/:id/session` — actions: `save`, `delete-saved` (delete-current removed; use message meta `{clear:true}`)
- `GET /api/umsg/status` — WS connection status
- `POST /api/umsg/reconnect` — reconnect all WS connections
- `POST /api/query` — direct SDK query (not used by u-msg flow)
- `GET /api/sessions` — legacy session list

## Known Debt
- Participant session store is flat JSON — no locking; concurrent writes could corrupt.
- `save` action is now a single write (copy semantic — current stays). No atomicity issue.
- `--dangerously-skip-permissions` still in cli-headless.ts.
- `/etc/hosts` entry for `u-llm.local` must be added manually (requires sudo): `127.0.0.1 u-llm.local`

## Session Handoff
- date: 2026-03-10
- phase: Stabilization — ready for end-to-end UI integration testing
- what's live: Service at u-llm.local:18180, 4 participants (cto, exec, audit, secretary), unified sessions (all roles persistent), structured message format (# Summary / # Content), clear-via-meta, 54 tests.
- what changed (spec 009): sessionPolicy removed — all roles get current/saved/fork/fresh. Incoming messages formatted. LLM responses parsed into summary+content. projectPath in config, sdkQuery accepts cwd.
- risks: Non-atomic save (see Known Debt). Flat JSON store has no write locking.
- next: UI integration testing. Then: next spec planning (participant management or bug fixes).
