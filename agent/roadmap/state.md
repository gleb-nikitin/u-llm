# Roadmap State

- active_spec: 004
- last_finished: 003
- next_spec: 005
- queue: []
- status_note: Spec 004 in progress. HTTP service (Hono) + always-on deploy (nginx, launchd). Port 18180. SSE streaming. Server workspace files at /Users/glebnikitin/work/server/.
- context_entrypoint: ./agent/docs/kb.md
- spec_summary:
  - 001: Project skeleton + Agent SDK basic (CLI tool, one-shot query) ✓
  - 002: CLI headless integration (subprocess wrapper, --via cli flag) ✓
  - 003: Session management + streaming (resume, persist, partial output) ✓
  - 004: HTTP service + always-on deploy (Hono server, nginx, launchd)
