# Roadmap State

- active_spec: none
- last_finished: 005
- next_spec: 006
- queue: []
- status_note: Spec 005 complete. u-llm is a live participant in u-msg chains. WS connected, messages received and responded. Multi-turn via chain→session mapping. Known issue: u-msg list-chains query has column count bug (u-msg side, not u-llm).
- context_entrypoint: ./agent/docs/kb.md
- spec_summary:
  - 001: Project skeleton + Agent SDK basic (CLI tool, one-shot query) ✓
  - 002: CLI headless integration (subprocess wrapper, --via cli flag) ✓
  - 003: Session management + streaming (resume, persist, partial output) ✓
  - 004: HTTP service + always-on deploy (Hono server, nginx, launchd) ✓
  - 005: u-msg integration (WebSocket participant, chain→session, multi-turn) ✓
