# Roadmap Intent

## Global Goals
- Project: u-llm
- Vision: Next-level git-like communication platform for people and agents. Intent-first.
- Backend: LLM-first. Frontend: humans-first.
- u-llm's role: bridge adapter connecting LLM providers as participants in u-msg chains.

## Provider Order
1. Claude (primary, current focus)
2. OpenAI (second)
3. Ollama / local LLMs (last)

## What's Done
Specs 001–009 complete. Foundation through unified session intelligence.
- HTTP service always-on at u-llm.local:18180 (launchd + nginx)
- Multi-participant WS connections, role-based routing, config-driven
- Role prompts externalized to `data/prompts/{role}.md`
- Unified sessions: all roles get current/saved/fork/fresh (no ephemeral/persistent split)
- Structured message format: `# Summary / # Content` in/out, explicit summary written to u-msg
- Clear-via-meta: `msg.meta.clear=true` replaces delete-current API action
- Session control API: `GET /api/participants`, `GET/POST /api/participants/:id/session`
- projectPath in config, sdkQuery accepts cwd option
- 54 tests passing

Details: `./agent/roadmap/archive.md`

## What's Next

### Phase: Stabilization (current)
- UI integration testing — verify end-to-end message flow with structured format
- Fix bugs found during integration
- Clean up known debt (see `kb.md`)

### Phase: Participant management
- Address Book — dynamic participant registration, role changes
- Needs discussion: do we need it if free-form works?

### Phase: Agent tooling
- MCP tools for agents (chain search, context fetch)
- Dynamic context assembly, chain protocol

### Phase: Automated orchestration
- COO agent manages CTO→Executor→Auditor→Git cycle

## Direction Rules
- Keep specs concise, implementation-oriented, and testable.
- Keep context files compact and suitable for no-history sessions.
- u-msg-ui is the donor project for TS patterns, build setup, and backend integration code.
- u-msg backend is the protocol authority — u-llm speaks its message contract.

## Decisions
<!-- Log direction-changing decisions. Format: date | decision | rationale -->
- 2026-03-09 | Primary integration: Agent SDK + Streaming + session persistence | Recommended model for interactive applications with session lifecycle primitives.
- 2026-03-09 | Stack: TypeScript + Bun | Matches u-msg-ui donor, shared ecosystem.
- 2026-03-09 | Auth: Claude Max OAuth (no API key) | Personal/internal use, SDK/CLI inherit local session.
- 2026-03-09 | Multi-participant via config file, not env vars | `data/participants.json` is sole source of truth. Editable without rebuild.
- 2026-03-09 | Session policy inferred from role | cto/secretary/coo → persistent; everything else → ephemeral. Override per participant in JSON. [SUPERSEDED by spec 009]
- 2026-03-10 | Unified sessions — all roles persistent | Even ephemeral roles need 2-3 resumes per task. sessionPolicy removed. Clear-via-meta replaces delete-current. Saved sessions as "briefings" for all roles.
- 2026-03-09 | Session checkpoints via HTTP API, not u-msg control messages | Keep messaging clean. Separate control plane.
- 2026-03-09 | Two-slot session model (current + saved) | Simple, covers save/fork/discard. No branch trees.
