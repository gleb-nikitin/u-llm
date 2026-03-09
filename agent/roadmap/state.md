# Roadmap State

- active_spec: none
- last_finished: 008
- next_spec: TBD
- queue: []
- status_note: Spec 008 complete. Persistent roles now have save/restore checkpoints (two-slot store, fork-from-saved). Session control API live at /api/participants. Participant list endpoint added. 33 tests passing.
- context_entrypoint: ./agent/docs/kb.md
- spec_summary:
  - 001: Project skeleton + Agent SDK basic (CLI tool, one-shot query) ✓
  - 002: CLI headless integration (subprocess wrapper, --via cli flag) ✓
  - 003: Session management + streaming (resume, persist, partial output) ✓
  - 004: HTTP service + always-on deploy (Hono server, nginx, launchd) ✓
  - 005: u-msg integration (WebSocket participant, chain→session, multi-turn) ✓
  - 006: Multi-participant sessions (N WS connections, role-based routing, ephemeral/persistent, per-participant config) ✓
  - 007: Role prompts from files, parsing hardening, full content for all, test coverage ✓
  - 008: Session checkpoints for persistent roles (two-slot store, fork-from-saved, session control API) ✓
