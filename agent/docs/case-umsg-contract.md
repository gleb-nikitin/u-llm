# u-msg Integration Contract

## Source
Provided by u-msg CTO session, 2026-03-09.

## Participant Model
- No participant registry in u-msg.
- Any client/service acts as participant using string participant IDs.
- Write identity: `X-Participant-Id` header; `from_id` in body optional but must match header if provided.
- No auth/token enforcement.
- Identifier safety: `'`, `\`, `;`, control chars rejected; max length checks.

## API Endpoints

### Chain Creation
```
POST /api/chains
  Headers: X-Participant-Id: <id>
  Body: WriteRequest
  Response: { msg_id, chain_id, seq }
```

### Append Message
```
POST /api/chains/:chain_id/messages
  Headers: X-Participant-Id: <id>
  Body: WriteRequest
  Response: { msg_id, chain_id, seq }
```

### Read History
```
GET /api/chains/:chain_id/messages?limit=N
  Response: StoredMessage[]
```

### List Chains
```
GET /api/chains?participant={id}&limit={N}
  Response: chains with unread counts
```

### Inbox (Unread)
```
GET /api/inbox?for={participant_id}&limit={N}
```

### Digest (Summaries Only)
```
GET /api/digest?for={participant_id}&limit={N}
  Response: flat list of per-message summaries across all chains
  Fields: chain_id, seq, from_id, summary, ts, type
  Sorted by ts DESC (newest first). No content field.
```

LLM consumer pattern:
1. `GET /api/digest?for=u-llm_cto&limit=50` → scan summaries
2. Identify interesting `chain_id` + `seq` → decide what to read
3. `GET /api/chains/{chain_id}/messages` → fetch full content

### Mark Read
```
POST /api/chains/:chain_id/read
  Body: { participant, through? }
```

### Health
```
GET /healthz
```

## WebSocket
```
WS /ws/stream?participant={id}
Events: { type: "new_message", message: StoredMessage }
Fan-out: to participants in notify[] (deduped).
response_from is auto-merged into notify on write.
```

## Message Types

```typescript
type MessageType = "chat" | "event" | "status" | "error";

type WriteRequest = {
  producer_key?: string;        // optional (server generates if omitted)
  from_id?: string;             // optional (defaults from X-Participant-Id)
  notify: string[];             // required; may be [] only if response_from present
  response_from?: string | null;
  type: MessageType;            // required
  event_type?: string | null;   // required when type === "event"
  external_ref?: string | null;
  summary?: string;             // optional; auto-generated when omitted
  content: string;              // required
  meta?: unknown | null;        // JSON-compatible
};

type WriteResponse = { msg_id: string; chain_id: string; seq: number };

type StoredMessage = {
  ts: string;
  producer_key: string;
  msg_id: string;
  chain_id: string;
  seq: number;
  from_id: string;
  notify: string[];
  response_from: string | null;
  type: MessageType;
  event_type: string | null;
  external_ref: string | null;
  summary: string;
  content: string;
  meta: unknown | null;
};
```

## Base URL / Auth
- Backend commonly at `http://chain-api.u-msg.local:18080` (port 18080).
- Runtime default bind: `:8000`, override with `UMSG_PORT`.
- No auth headers required beyond `X-Participant-Id` on writes.

## Key Source Refs (u-msg repo)
- `chains.ts` (line 58) — identifier safety
- `safe-identifier.ts` (line 15) — validation rules
- `app.ts` (line 49) — route setup
- `protocol-types.ts` — type definitions
- `validate-message.ts` — write validation
- `stream.ts` — WebSocket fan-out
- `publish-new-message.ts` — notification logic
- `write-message.ts` — write path
- `config.ts` (line 13) — port config
