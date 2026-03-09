# Roadmap State

- active_spec: 005
- last_finished: 004
- next_spec: 006
- queue: []
- status_note: Spec 005 in progress. u-msg WebSocket integration. Participant u-llm connects to chain-api.u-msg.local:18080. Chain→session mapping for multi-turn. u-msg-ui available for live testing.
- context_entrypoint: ./agent/docs/kb.md
- spec_summary:
  - 001: Project skeleton + Agent SDK basic (CLI tool, one-shot query) ✓
  - 002: CLI headless integration (subprocess wrapper, --via cli flag) ✓
  - 003: Session management + streaming (resume, persist, partial output) ✓
  - 004: HTTP service + always-on deploy (Hono server, nginx, launchd) ✓
  - 005: u-msg integration (WebSocket participant, chain→session, multi-turn)
