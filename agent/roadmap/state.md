# Roadmap State

- active_spec: none
- last_finished: 006
- next_spec: TBD
- queue: []
- status_note: Spec 006 complete. u-llm is now a multi-participant service. N independent WebSocket connections, each with its own role, model, session policy, and system prompt. Ephemeral (fresh per message) and persistent (simple resume) session patterns live. Config driven by `data/participants.json` — editable without rebuild.
- context_entrypoint: ./agent/docs/kb.md
- spec_summary:
  - 001: Project skeleton + Agent SDK basic (CLI tool, one-shot query) ✓
  - 002: CLI headless integration (subprocess wrapper, --via cli flag) ✓
  - 003: Session management + streaming (resume, persist, partial output) ✓
  - 004: HTTP service + always-on deploy (Hono server, nginx, launchd) ✓
  - 005: u-msg integration (WebSocket participant, chain→session, multi-turn) ✓
  - 006: Multi-participant sessions (N WS connections, role-based routing, ephemeral/persistent, per-participant config) ✓
