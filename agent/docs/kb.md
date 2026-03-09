# Knowledge Base

## Lazy-Load Index
- `./agent/docs/arch.md` — architecture, stack, boundaries, ecosystem map.
- `./agent/docs/run.md` — run/build/test commands.
- `./agent/docs/llm-connect.md` — LLM connection index: architecture decision, auth, models, doc links.
- `./agent/docs/case-cli-headless.md` — CLI subprocess integration (one-shot, streaming, multi-turn, subagents).
- `./agent/docs/case-agent-sdk.md` — Agent SDK integration (TS/Python query, sessions, MCP tools, subagents).
- `./agent/docs/case-orchestration.md` — Multi-agent patterns, token efficiency, CTO context protection.
- `./agent/docs/case-umsg-contract.md` — u-msg integration contract: API endpoints, message types, WebSocket, participant model.
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

## Known Debt
- No tests yet.
- Session store is flat JSON — no locking; concurrent writes could corrupt.
- `--dangerously-skip-permissions` still in cli-headless.ts.
- `/etc/hosts` entry for `u-llm.local` must be added manually (requires sudo): `127.0.0.1 u-llm.local`

## Session Handoff
- date: 2026-03-09
- what changed: Spec 004 executed. Hono HTTP server on port 18180. /health, /api/query (stream + non-stream), /api/sessions. onDelta callback added to SdkQueryOptions and CliQueryOptions — SSE routes push deltas via it instead of stdout. Nginx conf, start script, launchd plist added to server workspace. u-llm added to always-on.sh SERVICES array. Symlink at server/projects/u-llm. Launchd service installed and running.
- why: HTTP surface for other projects to consume u-llm capabilities.
- risks: /etc/hosts entry for u-llm.local not added (needs sudo; user must do manually). Session store still flat JSON with no write locking.
- next checks: add `127.0.0.1 u-llm.local` to /etc/hosts, then `curl http://u-llm.local/health` should return ok.
