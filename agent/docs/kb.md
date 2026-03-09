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

## Known Debt
- No implementation — project is knowledge base and context only.
- Server workspace entry (nginx conf, launchd plist, start script) not yet created.

## Session Handoff
- date: 2026-03-09
- what changed: established project context from template. Created LLM connection knowledge base (index + 3 case files). Updated all context/roadmap files with project-specific content.
- why: prepare workspace for agents so no-history sessions can understand the project and start implementing.
- risks: no code yet, all reference material. Agent SDK examples not validated against live SDK.
- next checks: define and accept Spec 001 for first Claude connection implementation.
