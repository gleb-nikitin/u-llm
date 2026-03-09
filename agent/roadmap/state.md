# Roadmap State

- active_spec: none
- last_finished: 007
- next_spec: TBD
- queue: []
- status_note: Spec 007 complete. Role prompts externalized to `data/prompts/`. Parser hardened for all ID edge cases. All participants get full message content. 20 tests passing. First test coverage in the project.
- context_entrypoint: ./agent/docs/kb.md
- spec_summary:
  - 001: Project skeleton + Agent SDK basic (CLI tool, one-shot query) ✓
  - 002: CLI headless integration (subprocess wrapper, --via cli flag) ✓
  - 003: Session management + streaming (resume, persist, partial output) ✓
  - 004: HTTP service + always-on deploy (Hono server, nginx, launchd) ✓
  - 005: u-msg integration (WebSocket participant, chain→session, multi-turn) ✓
  - 006: Multi-participant sessions (N WS connections, role-based routing, ephemeral/persistent, per-participant config) ✓
  - 007: Role prompts from files, parsing hardening, full content for all, test coverage ✓
