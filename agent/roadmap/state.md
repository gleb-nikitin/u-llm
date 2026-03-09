# Roadmap State

- active_spec: none
- last_finished: none
- next_spec: 001
- queue: [001, 002, 003, 004]
- status_note: Specs 001-004 drafted and awaiting acceptance. Phase 1 (Claude connections) = specs 001-003, Phase 2 start (HTTP service + always-on) = spec 004.
- context_entrypoint: ./agent/docs/kb.md
- spec_summary:
  - 001: Project skeleton + Agent SDK basic (CLI tool, one-shot query)
  - 002: CLI headless integration (subprocess wrapper, --via cli flag)
  - 003: Session management + streaming (resume, persist, partial output)
  - 004: HTTP service + always-on deploy (Hono server, nginx, launchd)
