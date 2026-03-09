# Spec 005: u-msg Integration

## Goal
Connect u-llm as a participant in u-msg chains. After this spec, a user can send a message to u-llm through u-msg and receive Claude's response in the same chain — with multi-turn conversation support.

## Context
- Specs 001-004 delivered: SDK/CLI query, sessions, HTTP service at `u-llm.local`.
- u-msg has no webhook/callback push — uses WebSocket for real-time message delivery.
- No participant registry — any service can act as participant via `X-Participant-Id` header.
- u-llm is the first external participant integration for u-msg.

## Architecture

```
User (via u-msg-ui)
  │
  ├─ writes message to chain with notify: ["u-llm"]
  │
  ▼
u-msg backend (chain-api.u-msg.local:18080)
  │
  ├─ fan-out new_message event via WebSocket
  │
  ▼
u-llm (WS client, participant_id: "u-llm")
  │
  ├─ receives new_message
  ├─ maps chain_id → Claude session_id
  ├─ sends content to Claude via sdkQuery (resume if existing session)
  ├─ writes Claude response back to chain via POST /api/chains/:chain_id/messages
  │
  ▼
User sees LLM response in u-msg-ui
```

## Deliverables
| File | Action |
|------|--------|
| `src/umsg/client.ts` | Create — u-msg API client (write message, read chain, mark read) |
| `src/umsg/ws.ts` | Create — WebSocket connection + reconnect logic |
| `src/umsg/handler.ts` | Create — message handler: receive → query Claude → write back |
| `src/umsg/session-map.ts` | Create — chain_id ↔ Claude session_id mapping (persisted) |
| `src/umsg/config.ts` | Create — u-msg connection config (base URL, participant ID) |
| `src/server.ts` | Modify — start WS connection on server boot |
| `src/routes/umsg.ts` | Create — GET /api/umsg/status, POST /api/umsg/reconnect |
| `package.json` | Modify — if any new deps needed |

## Interface

### u-msg API (consumed by u-llm)
```
POST http://chain-api.u-msg.local:18080/api/chains/:chain_id/messages
  Headers: X-Participant-Id: u-llm
  Body: WriteRequest { content, notify, type: "chat", response_from?, meta? }
  Response: { msg_id, chain_id, seq }

GET http://chain-api.u-msg.local:18080/api/chains/:chain_id/messages?limit=N
  Response: StoredMessage[]

POST http://chain-api.u-msg.local:18080/api/chains/:chain_id/read
  Body: { participant: "u-llm" }

WS ws://chain-api.u-msg.local:18080/ws/stream?participant=u-llm
  Receives: { type: "new_message", message: StoredMessage }
```

### u-llm HTTP endpoints (new)
```
GET /api/umsg/status
  Response: { "connected": true|false, "participant_id": "u-llm", "uptime_ms": N }

POST /api/umsg/reconnect
  Response: { "status": "reconnecting" }
```

## Behavior

### Message Flow
1. u-llm connects to u-msg WebSocket on server boot with `participant=u-llm`.
2. When a `new_message` event arrives where u-llm is in `notify` or `response_from`:
   a. Extract `content` as the user prompt.
   b. Look up chain_id in session map → get existing Claude session_id (if any).
   c. Call `sdkQuery(content, { resume: sessionId })` — new session if no mapping exists.
   d. Store the new/returned session_id in session map keyed by chain_id.
   e. Write Claude's response to the chain: `POST /api/chains/:chain_id/messages` with `from_id: "u-llm"`, `type: "chat"`, `notify: [originalMessage.from_id]`.
3. Mark the incoming message as read: `POST /api/chains/:chain_id/read`.

### Session Mapping
- Persisted to `data/chain-sessions.json` (same pattern as `data/sessions.json`).
- Shape: `{ [chain_id: string]: { session_id: string, last_used_at: string } }`.
- On first message in a chain: create new Claude session, store mapping.
- On subsequent messages: resume existing Claude session.

### WebSocket Reconnection
- On disconnect: exponential backoff reconnect (1s, 2s, 4s, 8s, max 30s).
- On reconnect: re-subscribe by connecting with same participant ID.
- Log connection state changes.

### Error Handling
- If Claude query fails: write error message to chain with `type: "error"`, `content: "LLM error: <message>"`.
- If u-msg write fails: log error, do not retry (avoid duplicate messages).
- If WebSocket connection fails on boot: keep retrying, don't crash the HTTP server.

### Ignoring Own Messages
- Skip any `new_message` where `from_id === "u-llm"` (prevent self-reply loops).

## Constraints
- Default to SDK path (`sdkQuery`) for LLM queries. CLI path available via message `meta.via` field (stretch goal, not required for MVP).
- Default model: `sonnet`. Can be overridden via message `meta.model` field (stretch goal).
- u-msg backend must be running for integration to work. If not reachable, u-llm HTTP server still functions (just no WS connection).
- Participant ID configurable via env var `UMSG_PARTICIPANT_ID` (default: `u-llm`).
- u-msg base URL configurable via env var `UMSG_BASE_URL` (default: `http://chain-api.u-msg.local:18080`).

## Acceptance Criteria
- [ ] 1. `bun run typecheck` passes.
- [ ] 2. On server start, u-llm connects to u-msg WebSocket (visible in server logs).
- [ ] 3. Sending a message to a chain with `notify: ["u-llm"]` triggers a Claude response written back to the chain.
- [ ] 4. Second message in same chain resumes the Claude session (multi-turn works).
- [ ] 5. `GET /api/umsg/status` returns connection state.
- [ ] 6. u-llm ignores its own messages (no self-reply loop).
- [ ] 7. WebSocket reconnects after disconnect.
- [ ] 8. Claude query error produces an error message in the chain (not silent failure).
- [ ] 9. Server starts normally even if u-msg is unreachable.
- [ ] 10. `data/chain-sessions.json` persists chain→session mappings.

## Verification

```bash
# Typecheck
bun run typecheck

# Start u-llm (should show WS connection log)
bun run dev

# Check u-msg connection
curl -s http://localhost:18180/api/umsg/status | jq .

# Send a test message via u-msg API (assumes u-msg is running)
curl -s -X POST http://chain-api.u-msg.local:18080/api/chains \
  -H 'Content-Type: application/json' \
  -H 'X-Participant-Id: test-user' \
  -d '{"content":"Hello, what is 2+2?","notify":["u-llm"],"type":"chat"}' | jq .

# Wait a few seconds for Claude to respond, then check chain messages
# (use chain_id from above response)
curl -s http://chain-api.u-msg.local:18080/api/chains/<chain_id>/messages | jq .

# Should see: user message + u-llm response

# Multi-turn: send follow-up
curl -s -X POST http://chain-api.u-msg.local:18080/api/chains/<chain_id>/messages \
  -H 'Content-Type: application/json' \
  -H 'X-Participant-Id: test-user' \
  -d '{"content":"Now multiply that by 10","notify":["u-llm"],"type":"chat"}' | jq .

# Check messages again — Claude should reference previous context
curl -s http://chain-api.u-msg.local:18080/api/chains/<chain_id>/messages | jq .

# Error handling: send with u-msg down (stop u-msg, restart u-llm)
# Server should start, log WS connection failure, keep retrying
```
