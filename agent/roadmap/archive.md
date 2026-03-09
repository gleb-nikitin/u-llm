# Completed Specs
# Append newest first.

## Spec 004: HTTP Service + Always-On Deploy
- spec: `./agent/specs/004-http-service-deploy.md`
- completed: 2026-03-09
- deliverables: `src/server.ts` (new), `src/routes/query.ts` (new), `src/routes/sessions.ts` (new), `src/sdk-query.ts` (onDelta), `src/cli-headless.ts` (onDelta), `package.json` (dev/start scripts, hono dep), `/Users/glebnikitin/work/server/nginx/conf.d/u-llm.conf`, `/Users/glebnikitin/work/server/scripts/start-u-llm-dev.sh`, `/Users/glebnikitin/work/server/launchd/com.gleb.work.server.u-llm.plist`, symlink at server/projects/u-llm
- result: Hono server on 18180. /health, /api/query (stream+non-stream), /api/sessions. SSE streaming via ReadableStream + onDelta callback. nginx routed via u-llm.local. Launchd service installed and running. 9/10 acceptance criteria passed (10 blocked by /etc/hosts needing sudo).

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
