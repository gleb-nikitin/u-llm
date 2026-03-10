# Project Context

## Snapshot
- Project: u-llm (LLM bridge adapters for u-msg)
- Workspace: /Users/glebnikitin/work/code/u-llm
- Domain: connects LLM providers as participants in u-msg messaging chains
- Active spec: none
- Last completed: 010 (config simplification)
- Tests: 47 passing (`bun test`)
- Main modules: `src/participants/` (config, session store), `src/umsg/` (ws-manager, handler, client), `src/sdk-query.ts`, `src/server.ts`, `src/routes/`

## Current Focus
- Specs 001-010 complete. Multi-participant LLM bridge with unified sessions and simplified config.
- Config: `data/participants.json` with explicit `project`, `role` fields, `defaultModel` (full SDK string), `defaultEffort`.
- Participant IDs: `{project}_{role}` format (e.g. `u-msg_cto`). No model suffix, no parsing.
- Unified sessions: all roles get current/saved slots. Clear-via-meta replaces delete-current.
- Structured messages: `# Summary / # Content` format in/out.
- Next phase: stabilization — UI integration testing, bug fixes, known debt cleanup.

## Agreed Constraints
- Claude Max OAuth auth (no API key), personal/internal use.
- Agent SDK is the primary integration path.
- u-msg backend is protocol authority — u-llm speaks its message contract.
- TypeScript + Bun stack (matches ecosystem).
- `data/participants.json` is the participant config source of truth (no env var).

## Risks
- Flat JSON session store has no write locking.
- Session store may have old-format IDs — will auto-create fresh entries on restart.
