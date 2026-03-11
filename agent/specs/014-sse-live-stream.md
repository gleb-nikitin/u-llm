# Spec 014: SSE Live Stream for Agent Observation

## Goal
Expose a Server-Sent Events endpoint from u-llm so humans (via u-msg-ui) can observe agent activity in real-time: streaming text, tool usage, reasoning, and completion status. Final messages still go to u-msg as before.

## Context
- Currently u-llm writes a single finished message to u-msg after SDK query completes
- `sdkQuery` already supports `stream: true` + `onDelta` callback but handler.ts never uses it
- The SDK message stream contains: partial text, tool use events, thinking blocks, system events
- u-msg is for finished messages (protocol authority) — live observation is a separate concern
- u-msg-ui proposed SSE endpoint design: `GET /api/stream?participant={id}`
- SSE is one-way, browser-native auto-reconnect, simpler than WS for this use case

## Design

### SSE Endpoint

```
GET /api/stream
GET /api/stream?participant={id}
```

- Without `?participant` — stream events from ALL active participants
- With `?participant=u-llm_exec` — filter to one participant
- Response: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Multiple clients can connect simultaneously (fan-out)

### Event Types

```
event: start
data: {"participant_id":"u-llm_exec","chain_id":"chain_123","timestamp":"..."}

event: token
data: {"participant_id":"u-llm_exec","text":"chunk of text"}

event: tool_use
data: {"participant_id":"u-llm_exec","tool":"Read","input":{"file_path":"/src/server.ts"}}

event: tool_result
data: {"participant_id":"u-llm_exec","tool":"Read","summary":"read 120 lines"}

event: done
data: {"participant_id":"u-llm_exec","session_id":"abc-123","turns":3,"cost_usd":0.0042,"duration_ms":4500}

event: error
data: {"participant_id":"u-llm_exec","error":"LLM error: rate limited"}
```

- `start`: emitted when handler begins SDK query for a participant
- `token`: text deltas as they arrive from SDK stream
- `tool_use`: when the agent calls a tool (file read, bash, grep, etc.)
- `tool_result`: brief summary when tool returns (not full content — that would flood the stream)
- `done`: query complete, includes cost/turns/session metadata
- `error`: query failed

### Architecture

```
                          SSE clients (u-msg-ui, curl, etc.)
                               │
                    GET /api/stream?participant=...
                               │
                         ┌─────▼─────┐
                         │  SSE Hub  │  (in-memory fan-out)
                         └─────▲─────┘
                               │
                          emit(event)
                               │
                    ┌──────────┴──────────┐
                    │   handler.ts        │
                    │   sdkQuery(stream:   │──── final msg ──── u-msg
                    │     true, onEvent)  │
                    └─────────────────────┘
```

## Deliverables

| File | Action | Purpose |
|------|--------|---------|
| `src/sse/hub.ts` | New | SSE client registry + fan-out. `addClient(res, filter?)`, `removeClient(res)`, `emit(event)` |
| `src/routes/stream.ts` | New | Hono route: `GET /api/stream`, manages SSE connections |
| `src/sdk-query.ts` | Modify | Add `onEvent` callback alongside existing `onDelta`. Emit structured events for tool_use, tool_result, token, etc. |
| `src/umsg/handler.ts` | Modify | Pass `stream: true` + `onEvent` that pushes to SSE hub. Emit `start` and `done`/`error` events. |
| `src/server.ts` | Modify | Mount stream route, initialize SSE hub |

## SSE Hub Design

```typescript
interface SSEClient {
  id: string;
  response: Response;       // Hono streaming response
  participantFilter?: string; // optional filter
}

class SSEHub {
  private clients: Map<string, SSEClient>;

  addClient(id: string, response: Response, participantFilter?: string): void;
  removeClient(id: string): void;
  emit(event: SSEEvent): void;  // fans out to matching clients
}
```

- Singleton, created at server start
- `emit()` serializes event as SSE format and writes to all matching client responses
- Client disconnect detected via response close/error — auto-cleanup

## SDK Message Parsing

The SDK `query()` iterator yields multiple message types. Map them to SSE events:

| SDK message | SSE event | What to extract |
|---|---|---|
| Partial message with text content | `token` | Delta text (diff from previous) |
| Message with `tool_use` content block | `tool_use` | Tool name + input summary |
| Message with `tool_result` content block | `tool_result` | Tool name + truncated output |
| Result message | `done` | session_id, turns, cost, duration |
| No result message type | `error` | Error from catch block |

Existing `onDelta` callback handles text streaming. New `onEvent` callback handles all structured events including tool use.

## Handler Changes

```typescript
// handler.ts — inside the try block, before sdkQuery call
sseHub.emit({ type: 'start', participant_id: participantId, chain_id: chainId });

const result = await sdkQuery(prompt, {
  ...existingOptions,
  stream: true,
  onEvent: (event) => sseHub.emit({ ...event, participant_id: participantId }),
});

sseHub.emit({
  type: 'done',
  participant_id: participantId,
  session_id: result.sessionId,
  turns: result.numTurns,
  cost_usd: result.costUsd,
  duration_ms: result.durationMs,
});
```

## sdkQuery Changes

Replace simple `onDelta` with richer `onEvent` callback:

```typescript
interface SdkEvent {
  type: 'token' | 'tool_use' | 'tool_result';
  text?: string;          // for token
  tool?: string;          // for tool_use / tool_result
  input?: unknown;        // for tool_use (summarized)
  summary?: string;       // for tool_result (truncated)
}

interface SdkQueryOptions {
  // ... existing
  onEvent?: (event: SdkEvent) => void;
}
```

Keep `onDelta` for backward compatibility (CLI usage). `onEvent` is the richer interface for SSE.

## Acceptance Criteria

1. [ ] `GET /api/stream` returns SSE stream with correct headers
2. [ ] `?participant={id}` filters events to that participant
3. [ ] `start` event emitted when handler begins processing a message
4. [ ] `token` events stream text deltas in real-time
5. [ ] `tool_use` events show tool name and input summary
6. [ ] `done` event includes session_id, turns, cost, duration
7. [ ] `error` event emitted on SDK query failure
8. [ ] Multiple SSE clients can connect simultaneously
9. [ ] Client disconnect is handled gracefully (no leaked connections)
10. [ ] Final message to u-msg still works as before (no regression)
11. [ ] Existing tests pass
12. [ ] Manual test: `curl -N http://localhost:18180/api/stream` shows live events during agent activity

## Out of Scope
- Persisting stream events (ephemeral only — connect to observe, miss it if not connected)
- Replay / history of events
- Authentication on SSE endpoint
- tool_result full content (too large — summary only)
- Thinking/reasoning block content (may add later as opt-in)
- u-msg-ui rendering (separate project, separate spec)