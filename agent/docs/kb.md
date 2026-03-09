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
- `./agent/docs/u-llm-sdk-session-spec.md` — brainstorm decisions: session policies, CTO fork pattern, context assembly.
- `./agent/roadmap/intent.md` — global goals, MVP strategy, direction decisions.

## Donor Projects
- `u-msg-ui` (`/Users/glebnikitin/work/code/u-msg-ui/`) — TS patterns, Bun setup, u-msg backend integration. Indexed in code-indexer.
- `u-msg` (`/Users/glebnikitin/work/code/u-msg/`) — backend protocol, message contract. Indexed in code-indexer.

## Deep Reference (kb disk)
- `/Users/glebnikitin/disk/kb/claude/` — downloaded Claude docs (7889 chunks indexed as `kb-claude` in code-indexer).
- `/Users/glebnikitin/disk/u-llm/claude-sdk-cli-ssh.md` — source context file for this project's LLM connection docs.

## Spec Index
- `./agent/specs/001-skeleton-sdk-basic.md` — project skeleton + Agent SDK one-shot query.
- `./agent/specs/002-cli-headless.md` — CLI subprocess wrapper, `--via cli` flag.
- `./agent/specs/003-sessions-streaming.md` — session persistence, resume, streaming partial output.
- `./agent/specs/004-http-service-deploy.md` — Hono HTTP server, SSE streaming, nginx + launchd always-on.
- `./agent/specs/005-umsg-integration.md` — u-msg WebSocket integration, chain→session mapping, LLM participant.
- `./agent/specs/006-multi-participant-sessions.md` — N participants, role-based routing, ephemeral/persistent sessions, per-participant config.
- `./agent/specs/007-role-prompts-parsing-tests.md` — role prompts from files, parsing hardening, full content for all, test coverage.

## Key Runtime Config
- `data/participants.json` — source of truth for active participants (id, model override, sessionPolicy override). rolePrompt field is optional filename.
- `data/prompts/{role}.md` — role prompt files. Resolution: explicit field → `{role}.md` → `default.md` → inline fallback.
- `data/participant-sessions.json` — persistent role session state (participantId → sessionId).
- Participant ID convention: `{project}-{role}-{model}` (e.g. `umsg-cto-o`, `umsg-exec-s`). Model segment: `o`=opus, `s`=sonnet, `h`=haiku.

## Known Debt
- Participant session store is flat JSON — no locking; concurrent writes could corrupt.
- `save` action in `src/routes/session.ts` is non-atomic: two separate file writes (setSavedSession + clearCurrentSession). A crash between them leaves saved set and current non-null. Fix requires write locking or single-write transaction.
- `--dangerously-skip-permissions` still in cli-headless.ts.
- `/etc/hosts` entry for `u-llm.local` must be added manually (requires sudo): `127.0.0.1 u-llm.local`

## Session Handoff
- date: 2026-03-09
- what changed: Spec 008 complete. Two-slot session store (currentSessionId + savedSessionId) with auto-migration. Persistent roles fork from saved checkpoint when no current exists. Session control API: `GET /api/participants`, `GET/POST /api/participants/:id/session`. `resolveSessionOptions` extracted from handler as pure exported function. 33 tests passing.
- why: Persistent roles needed save/restore to protect accumulated context from auto-compaction degradation. Fork-from-saved means bad conversations are discardable without losing the checkpoint.
- risks: `save` action is non-atomic (two file writes — see Known Debt). Flat JSON session store still has no write locking. `scripts/test-fork.ts` SDK fork verification requires live run (not yet executed).
- next: Live validation (restart service, run test-fork.ts, test session API). Address Book. Phase 3 participant management.
