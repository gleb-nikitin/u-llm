# Spec 017: Full SSE Stream — Forward All SDK Events

## Problem

The SSE stream currently forwards a simplified subset of SDK messages. The UI gets `token`, `tool_use`, `tool_result`, `thinking`, `start`, `done`, `error` — but loses system events (init, compact), usage data, model info per message, stop reasons, and raw message structure.

## Goal

Forward everything the SDK gives us to the SSE stream. The UI decides what to render.

## Changes

### 1. Expand `SdkEvent` types (sdk-query.ts)

Add new event types to capture what we currently drop:

```typescript
export interface SdkEvent {
  type: "token" | "tool_use" | "tool_result" | "thinking" | "system" | "result";
  text?: string;
  tool?: string;
  input?: unknown;
  summary?: string;
  result?: string;
  // New fields
  subtype?: string;        // system: "init" | "compact_boundary"; result: "success" | "error_*"
  session_id?: string;     // from init message
  model?: string;          // from AssistantMessage.model
  usage?: unknown;         // token usage object from AssistantMessage
  stop_reason?: string;    // from AssistantMessage
  num_turns?: number;      // from result
  cost_usd?: number;       // from result
  duration_ms?: number;    // from result
}
```

### 2. Capture new events in sdk-query.ts message loop

Add handling for messages we currently skip:

- **`system` + `init`**: emit `{ type: "system", subtype: "init", session_id }`
- **`system` + `compact_boundary`**: emit `{ type: "system", subtype: "compact_boundary" }`
- **`result`**: emit `{ type: "result", subtype, session_id, model, num_turns, cost_usd, duration_ms }`
- **AssistantMessage metadata**: on each assistant message, emit model/usage/stop_reason with a `token` or as separate event

### 3. Adjust truncation

- `tool_use` input: keep at 100 chars
- `tool_result` result: increase from 200 → **400 chars**
- `thinking` text: no truncation (forward full)
- `token` text: no truncation (already delta-only)

### 4. Update SSEEvent interface (sse/hub.ts)

Add the new fields to `SSEEvent` so the hub passes them through:

```typescript
interface SSEEvent {
  type: string;
  participant_id?: string;
  // existing
  text?: string;
  tool?: string;
  input?: unknown;
  result?: string;
  summary?: string;
  session_id?: string;
  model?: string;
  turns?: number;
  cost_usd?: number;
  duration_ms?: number;
  // new
  subtype?: string;
  usage?: unknown;
  stop_reason?: string;
  num_turns?: number;
  timestamp?: string;
  error?: string;
  chain_id?: string;
}
```

### 5. No changes to detail mode filtering

Keep the existing filter logic in hub.ts. Verbose mode already passes all event types. The new `system` and `result` types should be added to verbose (all events pass) and optionally to standard.

Update filter:
- **minimal**: start, done, error (unchanged)
- **standard**: start, done, error, token, tool_use, result
- **verbose**: all (unchanged — already `return true`)

## Files Changed

| File | Change |
|---|---|
| `src/sdk-query.ts` | Capture system/result events, increase tool_result truncation to 400, add fields to onEvent calls |
| `src/sse/hub.ts` | Expand SSEEvent interface with new fields, update standard filter to include `result` |

## What NOT to change

- The `done` event in handler.ts stays as-is (it's our custom event, not an SDK passthrough)
- The `start` event in handler.ts stays as-is
- Cost logging in handler.ts stays as-is
- No changes to u-msg-ui — that's a separate project/spec

## Acceptance Criteria

- [x] `system` init event forwarded (includes session_id)
- [x] `system` compact_boundary event forwarded
- [x] `result` event forwarded (includes subtype, cost, turns, duration, model)
- [x] `tool_result` truncated at 400 chars (was 200)
- [x] `thinking` text forwarded without truncation
- [x] AssistantMessage.model forwarded on result event
- [x] Standard detail mode includes `result` event type
- [x] Existing events unchanged (token, tool_use, start, done, error)
- [x] Tests pass
