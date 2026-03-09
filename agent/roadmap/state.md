# Roadmap State

- active_spec: none
- last_finished: 004
- next_spec: 005
- queue: []
- status_note: Spec 004 complete. HTTP service live on port 18180 via launchd. nginx configured for u-llm.local. Pending: add `127.0.0.1 u-llm.local` to /etc/hosts (requires sudo, user must do).
- context_entrypoint: ./agent/docs/kb.md
- spec_summary:
  - 001: Project skeleton + Agent SDK basic (CLI tool, one-shot query) ✓
  - 002: CLI headless integration (subprocess wrapper, --via cli flag) ✓
  - 003: Session management + streaming (resume, persist, partial output) ✓
  - 004: HTTP service + always-on deploy (Hono server, nginx, launchd)
