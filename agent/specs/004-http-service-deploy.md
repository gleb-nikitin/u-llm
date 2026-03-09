# Spec 004: HTTP Service + Always-On Deploy

## Goal
Wrap the SDK and CLI query paths in an HTTP server and deploy as an always-on service via the server workspace. After this spec, u-llm is a running service accessible at `u-llm.local`.

## Context
- Specs 001-003 delivered: SDK query, CLI headless query, session management, streaming.
- All capabilities are CLI-only — need HTTP surface for other projects to consume.
- Server workspace pattern: nginx in Docker (host-based routing) + launchd for always-on.
- Donor: u-msg-ui uses Hono on Bun for stub servers (port 8000/8001).
- u-msg backend runs on port 18080 via `chain-api.u-msg.local`.
- Reference: `/Users/glebnikitin/work/server/AGENTS.md` for server workspace conventions.

## Deliverables
| File | Action |
|------|--------|
| `src/server.ts` | Create — Hono HTTP server entry point |
| `src/routes/query.ts` | Create — POST /api/query endpoint |
| `src/routes/sessions.ts` | Create — GET /api/sessions, session management endpoints |
| `package.json` | Modify — add `dev` and `start` scripts |
| `/Users/glebnikitin/work/server/nginx/conf.d/u-llm.conf` | Create — nginx routing |
| `/Users/glebnikitin/work/server/scripts/start-u-llm-dev.sh` | Create — start script |
| `/Users/glebnikitin/work/server/launchd/com.gleb.work.server.u-llm.plist` | Create — launchd agent |
| `/Users/glebnikitin/work/server/projects/u-llm` | Create — symlink to project |
| `.gitignore` | Modify — ensure `data/` is ignored |

## Interface

### HTTP Endpoints

```
POST /api/query
  Body: { "prompt": "...", "model?": "sonnet|opus|haiku", "via?": "sdk|cli", "resume?": "<session_id>", "stream?": true }
  Response (non-streaming): { "result": "...", "session_id": "...", "duration_ms": N, "num_turns": N }
  Response (streaming): SSE stream of text deltas, final event is result JSON

GET /api/sessions
  Response: [{ "session_id": "...", "last_used_at": "...", "prompt_preview": "..." }, ...]

GET /health
  Response: { "status": "ok", "uptime_ms": N }
```

### Domain
- `u-llm.local` → nginx → `host.docker.internal:<PORT>`

### CLI preserved
- `bun run src/cli.ts` still works as before (Specs 001-003 not broken).

## Behavior
1. `server.ts` starts Hono on Bun, listens on configurable port (default: 18180).
2. `POST /api/query` accepts JSON body, delegates to `sdkQuery` or `cliQuery` based on `via` field.
3. If `stream: true`, response uses SSE (`text/event-stream`): emits `data: {"type":"delta","text":"..."}` events, then `data: {"type":"result",...}` final event.
4. If `stream: false` (default), waits for completion and returns full result JSON.
5. `resume` field passes through to query functions for session continuity.
6. `GET /api/sessions` reads from session store and returns list.
7. `GET /health` returns uptime and status.
8. nginx conf routes `u-llm.local` to the service port.
9. launchd plist keeps the service running via the start script.
10. Start script: `cd /Users/glebnikitin/work/code/u-llm && bun run src/server.ts`.

## Constraints
- No authentication on HTTP endpoints — local network only (same as u-msg pattern).
- No WebSocket in this spec — SSE is sufficient for streaming. WS can be added later.
- Port must not conflict with existing services (18080 = u-msg, 8001 = ui-state, 5173 = vite).
- Server workspace changes are outside this git repo — executor must write to `/Users/glebnikitin/work/server/`.
- Keep Hono as the only new dependency (already used in u-msg-ui).

## Acceptance Criteria
- [ ] 1. `bun run typecheck` passes.
- [ ] 2. `bun run dev` starts the HTTP server (Hono on Bun).
- [ ] 3. `curl http://localhost:18180/health` returns `{"status":"ok",...}`.
- [ ] 4. `curl -X POST http://localhost:18180/api/query -H 'Content-Type: application/json' -d '{"prompt":"say hi"}'` returns a result with response text and session_id.
- [ ] 5. `curl http://localhost:18180/api/sessions` returns session list.
- [ ] 6. SSE streaming works: `curl -N -X POST http://localhost:18180/api/query -H 'Content-Type: application/json' -d '{"prompt":"count to 5","stream":true}'` emits delta events.
- [ ] 7. `bun run src/cli.ts "test"` still works (CLI not broken).
- [ ] 8. nginx conf exists at `/Users/glebnikitin/work/server/nginx/conf.d/u-llm.conf` and routes `u-llm.local`.
- [ ] 9. launchd plist exists and service starts via `bash /Users/glebnikitin/work/server/scripts/always-on.sh install`.
- [ ] 10. `curl http://u-llm.local/health` returns ok after nginx reload.

## Verification

```bash
# Typecheck
bun run typecheck

# Start server
bun run dev &
sleep 2

# Health check
curl -s http://localhost:18180/health | jq .

# Query
curl -s -X POST http://localhost:18180/api/query \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"what is 2+2"}' | jq .

# Sessions
curl -s http://localhost:18180/api/sessions | jq .

# Streaming
curl -N -X POST http://localhost:18180/api/query \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"count to 5","stream":true}'

# CLI still works
bun run src/cli.ts "test"

# Kill server
kill %1

# Server workspace
ls /Users/glebnikitin/work/server/nginx/conf.d/u-llm.conf
ls /Users/glebnikitin/work/server/scripts/start-u-llm-dev.sh
ls /Users/glebnikitin/work/server/launchd/com.gleb.work.server.u-llm.plist

# Always-on install + nginx test
bash /Users/glebnikitin/work/server/scripts/always-on.sh install
docker compose -f /Users/glebnikitin/work/server/docker-compose.yml exec nginx nginx -t
curl -s http://u-llm.local/health | jq .
```
