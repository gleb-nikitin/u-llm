# Roadmap Intent

## Global Goals
- Project: u-llm
- Vision: Next-level git-like communication platform for people and agents. Intent-first.
- Backend: LLM-first. Frontend: humans-first.
- u-llm's role: bridge adapter project connecting LLM providers as participants in u-msg chains.

## Provider Order
1. Claude (primary, current focus)
2. OpenAI (second)
3. Ollama / local LLMs (last)

Matches u-msg decision: provider adapters live outside u-msg repo.

## MVP Strategy
- Build separated MVPs per integration method.
- Phase 1: 3 ways to connect to Claude (CLI headless, Agent SDK, orchestration).
- Phase 2: Connect to u-msg ecosystem using u-msg-ui as donor for TS patterns and shared backend integration.
- Once fully live, iterate to improve where needed.

## Near-Term Priorities
1. ~~Implement first Claude connection~~ ✓ (specs 001-003)
2. ~~Establish TS project skeleton with Bun runtime~~ ✓ (spec 001)
3. ~~Connect to u-msg backend as an LLM participant~~ ✓ (specs 004-005)
4. ~~Multi-participant role-based sessions~~ ✓ (spec 006)
5. Live validation of multi-participant setup.
6. CTO fork pattern (save/delete branch) — separate spec.
7. Address Book service for participant discovery.

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
- 2026-03-09 | Separated MVPs, iterate once live | Manage complexity by building focused increments.
- 2026-03-09 | Multi-participant via config file, not env vars | `data/participants.json` is sole source of truth. No env var filtering. Editable without rebuild.
- 2026-03-09 | Session policy inferred from role | cto/secretary/coo → persistent; everything else → ephemeral. Override per participant in JSON.
