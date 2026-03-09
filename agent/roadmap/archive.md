# Completed Specs
# Append newest first.

## Spec 003: Session Management + Streaming
- spec: `./agent/specs/003-sessions-streaming.md`
- completed: 2026-03-09
- deliverables: `src/session-store.ts` (new), `src/sdk-query.ts` (modified), `src/cli-headless.ts` (modified), `src/cli.ts` (modified), `.gitignore` (modified)
- result: Session persistence via `./data/sessions.json`. `--resume <id>`, `--continue`, `--sessions`, `--stream` flags live. SDK and CLI paths both support resume and streaming. 3 bugs found in audit and fixed: missing `includePartialMessages` in SDK stream path, empty sessionId guard, and `--verbose` required for `stream-json + --print`. 8/8 acceptance criteria passed.

## Spec 002: CLI Headless Integration
- spec: `./agent/specs/002-cli-headless.md`
- completed: 2026-03-09
- deliverables: `src/cli-headless.ts` (new), `src/cli.ts` (modified)
- result: CLI subprocess wrapper for `claude -p` with stream-json output. `--via cli` flag routes through subprocess path. 6/6 acceptance criteria passed.

## Spec 001: Project Skeleton + Agent SDK Basic
- spec: `./agent/specs/001-skeleton-sdk-basic.md`
- completed: 2026-03-09
- deliverables: `package.json`, `tsconfig.json`, `src/cli.ts`, `src/sdk-query.ts`
- result: CLI tool sends prompts to Claude via Agent SDK. One-shot query with `--model` flag. All 7 acceptance criteria passed.
