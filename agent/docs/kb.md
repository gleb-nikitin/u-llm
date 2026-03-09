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
- `--dangerously-skip-permissions` still in cli-headless.ts.
- `/etc/hosts` entry for `u-llm.local` must be added manually (requires sudo): `127.0.0.1 u-llm.local`

## Session Handoff
- date: 2026-03-09
- what changed: Spec 007 complete. Role prompts externalized to `data/prompts/{role}.md` with 4-step fallback. `parseParticipantId` hardened for all edge cases (empty, 1-seg, 2-seg ambiguous, 3+ without model). All participants get full message content (summary truncation removed). First test coverage: 20 tests via `bun test`.
- why: Config/parsing layer was brittle and untested. Role prompts outgrew inline JSON. Persistent roles were unnecessarily limited to truncated summaries.
- risks: Flat JSON session store (no write locking). Service needs restart to pick up changes.
- next: Live validation (restart service, verify prompt loading logs). CTO fork pattern. Address Book.
