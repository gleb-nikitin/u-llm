# Knowledge Base

## Lazy-Load Index
- `./agent/docs/arch.md` — architecture, stack, boundaries, ecosystem map.
- `./agent/docs/run.md` — run/build/test commands.
- `./agent/docs/llm-connect.md` — LLM connection index: architecture decision, auth, models, doc links.
- `./agent/docs/case-cli-headless.md` — CLI subprocess integration (one-shot, streaming, multi-turn, subagents).
- `./agent/docs/case-agent-sdk.md` — Agent SDK integration (TS/Python query, sessions, MCP tools, subagents).
- `./agent/docs/case-orchestration.md` — Multi-agent patterns, token efficiency, CTO context protection.
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

## Known Debt
- Server workspace entry (nginx conf, launchd plist, start script) planned in Spec 004.
- No tests yet — spec 001 kept skeleton minimal per constraint.

## Session Handoff
- date: 2026-03-09
- what changed: Spec 003 executed and accepted. Session persistence live: src/session-store.ts writes ./data/sessions.json. --resume, --continue, --sessions, --stream flags added to cli.ts. SDK and CLI headless paths both support resume and incremental streaming. Audit found and fixed 3 bugs: missing `includePartialMessages` in SDK stream path, empty sessionId guard in cli.ts, and --verbose required for stream-json + --print in CLI continue path.
- why: completes Phase 1 MVP — all 3 Claude connection capabilities (one-shot SDK, CLI subprocess, session resume) are live.
- risks: `--dangerously-skip-permissions` still in cli-headless.ts. No tests. Session store is a flat JSON file (no locking; concurrent writes could corrupt).
- next checks: start Spec 004 (HTTP service + always-on deploy).
