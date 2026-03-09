# Spec 006 — Multi-Participant Session Patterns

## Goal
Replace the single `u-llm` participant with N role-based participants, each with its own WebSocket connection, session policy, system prompt, and model. Ship two session patterns: **ephemeral** (fresh every message) and **persistent** (simple resume).

## Background
- u-llm currently has one participant ID (`u-llm`), one WS connection, one hardcoded model (`sonnet`), no system prompt, and dumb 1:1 chain→session mapping with always-resume.
- u-msg requires one participant per WS connection — no multi-participant per socket.
- Participant IDs follow the convention `{project}-{role}-{model}` (e.g. `umsg-cto-o`, `umsg-exec-s`). If model segment is missing, default to opus.
- CTO fork pattern (save/delete branch) is out of scope — separate spec. CTO uses simple resume here.

## Reference
- `agent/docs/how-to-sdk-claude.md` — SDK session mechanics.
- `agent/docs/u-llm-sdk-session-spec.md` — brainstorm decisions.
- `agent/docs/case-umsg-contract.md` — u-msg API contract.

---

## Deliverables

### D1: Participant Config (`src/participants/config.ts`)

Separate config file defining all active participants. Source of truth for the service. Designed for easy editing — user will change role prompts, models, and defaults frequently. Later this config moves to a UI.

**Config file**: `data/participants.json` (NOT in source code — lives next to data files, editable without rebuild).

```typescript
// Runtime type after loading + parsing
interface ParticipantConfig {
  id: string;            // full participant ID, e.g. "umsg-cto-o"
  role: string;          // parsed role: "cto", "exec", "audit", "git", "secretary", "research"
  model: string;         // SDK model string: "claude-opus-4-5", "claude-sonnet-4-5", etc.
  sessionPolicy: "ephemeral" | "persistent";
  rolePrompt: string;    // short static string for systemPrompt.append
}
```

**Config file format** (`data/participants.json`):
```json
{
  "defaults": {
    "model": "o",
    "rolePrompt": "You are a helpful assistant.",
    "sessionPolicy": "ephemeral"
  },
  "participants": [
    { "id": "umsg-cto-o", "rolePrompt": "You are CTO." },
    { "id": "umsg-exec-s", "rolePrompt": "You are Executor." },
    { "id": "umsg-audit-s", "rolePrompt": "You are Auditor." },
    { "id": "umsg-secretary-s", "rolePrompt": "You are Secretary." }
  ]
}
```

Parsing rules:
- `id` is the only required field per participant. Everything else falls back to defaults.
- Role and model are parsed from `id` via `parseParticipantId()`. If model segment is missing, use `defaults.model`.
- `sessionPolicy` is inferred from role: persistent for `cto`, `secretary`, `coo`; ephemeral for everything else. Can be overridden per participant.
- `rolePrompt` falls back to `defaults.rolePrompt`.
- If a participant sets `"model": "h"`, it overrides the model parsed from the ID.

Model mapping: `o` → `claude-opus-4-5`, `s` → `claude-sonnet-4-5`, `h` → `claude-haiku-4-5-20251001`.

Provide a helper: `parseParticipantId(id: string) → { project: string, role: string, model: string }`.

If `data/participants.json` doesn't exist, create it with a sensible default on first startup (log a message). This way a fresh deploy has something to work with.

### D2: Multi-WS Connection Manager (`src/umsg/ws-manager.ts`)

Replaces the current single-connection `ws.ts`. Manages N independent WebSocket connections, one per participant.

Public API:
```typescript
connectAll(participants: ParticipantConfig[]): void
disconnectAll(): void
onMessage(fn: (participantId: string, data: unknown) => void): void
getStatus(): Array<{ participantId: string; connected: boolean; uptimeMs: number }>
```

Each connection:
- URL: `${UMSG_BASE_URL.replace(/^http/, "ws")}/ws/stream?participant=${participantId}`
- Independent reconnect with exponential backoff (same logic as current `ws.ts`)
- Logs connect/disconnect per participant: `[ws:umsg-cto-o] connected`
- Passes `participantId` to the message listener so the handler knows which role received the event

Keep the old `ws.ts` file but stop importing it from `server.ts`. Don't delete it — the executor route (`/api/umsg`) may still reference it.

### D3: Updated Handler (`src/umsg/handler.ts`)

Handler receives `participantId` + WS event data. Changes:

1. **Signature**: `handleNewMessage(participantId: string, data: unknown)`
2. **Self-loop guard**: check `event.from_id !== participantId` (not the old global `UMSG_PARTICIPANT_ID`)
3. **shouldRespond check**: check `msg.notify?.includes(participantId) || msg.response_from === participantId`
4. **Lookup role config** from participant config
5. **Build prompt by role**:
   - **Persistent roles** (cto, secretary, coo): receive a **summary notification**, not the raw message. Format: `"[chain:<chain_id>] from:<from_id> summary: <truncated content>"`. The persistent session already has context — dumping full messages bloats it. The LLM can fetch full content if it needs to (via tools, or we add a fetch tool later).
   - **Ephemeral roles** (exec, audit, etc.): receive the **full message content** as the prompt. Each session is fresh, so the message IS the context.
6. **Session logic by policy**:
   - **ephemeral**: never pass `resume`, set `persistSession: false`
   - **persistent**: look up session from store, pass `resume: sessionId` if found, `persistSession: true`
7. **Write response**: use `participantId` as the `X-Participant-Id` header (not the old global)
8. **Pass role config to sdkQuery**: model, systemPrompt, persistSession

### D4: Updated `sdkQuery` (`src/sdk-query.ts`)

Extend `SdkQueryOptions` to accept the new fields:

```typescript
export interface SdkQueryOptions {
  model?: string;
  resume?: string;
  stream?: boolean;
  onDelta?: (text: string) => void;
  // New fields:
  systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string };
  persistSession?: boolean;
  maxTurns?: number;
  permissionMode?: string;
}
```

Pass these through to the SDK `query()` call. Defaults:
- `systemPrompt`: if not provided, omit (SDK default)
- `persistSession`: `true` (SDK default)
- `maxTurns`: `200`
- `permissionMode`: `"bypassPermissions"`

### D5: Session Store (`src/participants/session-store.ts`)

Simple JSON file at `data/participant-sessions.json`. Only used by persistent roles.

```typescript
interface ParticipantSessionEntry {
  participantId: string;
  sessionId: string;
  lastUsedAt: string;   // ISO timestamp
}

// Key: participantId → entry (one session per participant, NOT per chain)
```

**Important**: persistent roles have ONE session across all chains. The session is tied to the participant identity, not to the chain. A CTO has one ongoing conversation regardless of which chain the message came from.

Public API:
```typescript
getSession(participantId: string): string | undefined
setSession(participantId: string, sessionId: string): Promise<void>
clearSession(participantId: string): Promise<void>
```

The old `data/chain-sessions.json` and `data/sessions.json` are no longer used. Rename both to `.bak` on first startup (log a message). Don't write migration code — just archive.

### D6: Updated Client (`src/umsg/client.ts`)

`writeMessage` and `markRead` currently use the global `UMSG_PARTICIPANT_ID` for the `X-Participant-Id` header. Change them to accept `participantId` as a parameter:

```typescript
writeMessage(chainId: string, body: WriteRequest, participantId: string): Promise<WriteResponse>
fetchLatestMessage(chainId: string): Promise<StoredMessage | undefined>  // no change
markRead(chainId: string, participantId: string): Promise<void>
```

### D7: Updated Server Wiring (`src/server.ts`)

Replace single `connect()` + `onMessage()` with:
```typescript
import { loadParticipants } from "./participants/config";
import { WsManager } from "./umsg/ws-manager";

const participants = loadParticipants();
const wsManager = new WsManager();

wsManager.onMessage((participantId, data) => {
  handleNewMessage(participantId, data).catch((err) => {
    console.error(`[umsg:${participantId}] unhandled handler error:`, err);
  });
});

wsManager.connectAll(participants);
```

### D8: Health Endpoint Update

Extend `/health` to include per-participant WS status:

```json
{
  "status": "ok",
  "uptime_ms": 12345,
  "participants": [
    { "id": "umsg-cto-o", "connected": true, "uptime_ms": 12000 },
    { "id": "umsg-exec-s", "connected": true, "uptime_ms": 11500 }
  ]
}
```

### D9: Cost Logging

On every `ResultMessage`, log to stdout:
```
[cost] participant=umsg-cto-o session=<id> turns=<n> cost_usd=<x.xxxx> duration_ms=<ms>
```

No file-based cost tracking. Console only for Phase 1. Enough for grep.

---

## What Changes, What Stays

| Component | Action |
|-----------|--------|
| `src/umsg/ws.ts` | Keep file, stop importing from server.ts |
| `src/umsg/config.ts` | Remove global `UMSG_PARTICIPANT_ID` / `UMSG_WS_URL`. Keep `UMSG_BASE_URL`. |
| `src/umsg/handler.ts` | Rewrite — new signature, role-based routing |
| `src/umsg/client.ts` | Update — participantId parameter |
| `src/sdk-query.ts` | Extend — new options |
| `src/session-store.ts` | Keep file (HTTP routes may use it), stop using from handler |
| `src/umsg/session-map.ts` | Deprecated — replaced by participant session store |
| `src/server.ts` | Update wiring |
| `src/routes/umsg.ts` | May need updates if it references old ws.ts exports — check and fix |
| `data/chain-sessions.json` | Renamed to `.bak` |
| `data/sessions.json` | Renamed to `.bak` |

---

## Acceptance Criteria

1. [x] ~~`UMSG_PARTICIPANTS` env var~~ `data/participants.json` controls active participants. Service starts with N WS connections.
2. [x] Each WS connection logs `[ws:<participantId>] connected` on open.
3. [x] Message to an ephemeral participant (exec/audit) creates a fresh session every time — no resume, `persistSession: false`.
4. [x] Message to a persistent participant (cto/secretary) resumes the existing session — same `session_id` across turns.
5. [x] Each participant uses its configured model (opus/sonnet/haiku) — verify in sdkQuery options.
6. [x] Each participant gets `systemPrompt: { type: 'preset', preset: 'claude_code', append: '<role prompt>' }` passed to SDK.
7. [x] Self-loop guard works per participant — participant only ignores its own messages, not other participants'.
8. [x] `writeMessage` uses the correct participant ID in `X-Participant-Id` header.
9. [x] `/health` returns per-participant connection status.
10. [x] Cost logged to stdout on every query result.
11. [x] Old `chain-sessions.json` and `sessions.json` renamed to `.bak` on first startup.
12. [x] Service starts and all WS connections establish when tested with a default participant list.
