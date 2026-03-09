# Project Context

## Snapshot
- Project: u-llm (LLM bridge adapters for u-msg)
- Workspace: /Users/glebnikitin/work/code/u-llm
- Domain: connects LLM providers as participants in u-msg messaging chains
- Active spec: none
- Last completed: 006 (multi-participant sessions)
- Main modules: `src/participants/` (config, session store), `src/umsg/` (ws-manager, handler, client), `src/sdk-query.ts`, `src/server.ts`, `src/routes/`

## Current Focus
- Specs 001-006 complete. Multi-participant LLM bridge is live.
- Service runs N independent WS connections, one per participant in `data/participants.json`.
- Each participant has: role, model, system prompt, session policy (ephemeral or persistent).
- Next: live validation, then either CTO fork pattern or Address Book service.

## Agreed Constraints
- Claude Max OAuth auth (no API key), personal/internal use.
- Agent SDK is the primary integration path; CLI headless is secondary.
- u-msg backend is protocol authority — u-llm speaks its message contract.
- TypeScript + Bun stack (matches ecosystem).
- `data/participants.json` is the participant config source of truth (no env var).

## Risks
- No live validation of spec 006 yet (needs service restart + u-msg test).
- Flat JSON session store has no write locking.
- No tests.
