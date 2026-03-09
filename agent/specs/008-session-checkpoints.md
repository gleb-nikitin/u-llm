# Spec 008 — Session Checkpoints for Persistent Roles

## Goal
Give persistent roles (cto, secretary, coo) a save/restore mechanism: a "current" working session and a "saved" checkpoint. Users can save, discard, and restore sessions via HTTP API. On each new conversation after a save, u-llm forks from the checkpoint — the checkpoint stays clean.

## Background
- Persistent roles accumulate context over time. Auto-compaction degrades quality — early decisions, specs, and architectural context get summarized away.
- A checkpoint ("saved") preserves a known-good context state. New conversations fork from it — if a conversation goes badly, discard the fork and try again without losing the checkpoint.
- The SDK supports `forkSession: true` with `resume: sessionId` — creates a new session branching from the original. Original is preserved unchanged.
- This is generic for ALL persistent roles, not CTO-specific.

## Reference
- `agent/docs/how-to-sdk-claude.md` — SDK fork mechanics, `forkSession: true`.
- `agent/docs/u-llm-sdk-session-spec.md` — CTO fork pattern design, session store design.
- `src/participants/session-store.ts` — current session store (single slot per participant).
- `src/umsg/handler.ts` — current handler (simple resume for persistent roles).

---

## Deliverables

### D1: Verify SDK Fork (`scripts/test-fork.ts`)

Before building anything, verify `forkSession: true` works with our SDK version. Quick script:

1. Create a session with Haiku: send "Remember the word BANANA" → capture `sessionId`.
2. Fork: resume with `forkSession: true` → send "What word did I ask you to remember?" → capture `forkSessionId`.
3. Verify: `forkSessionId !== sessionId` and response contains "BANANA".
4. Verify original intact: resume `sessionId` (no fork) → send "What word?" → response contains "BANANA".

**If fork works:** proceed with D2–D7 using `forkSession: true`.
**If fork doesn't work:** fallback — "fork" means create a fresh session with the same system prompt. Lose history from checkpoint but keep the checkpoint for reference. Log a warning on startup. Proceed with D2–D7 using this fallback.

Run with: `bun scripts/test-fork.ts`. Cost: ~$0.01 (4 Haiku calls).

### D2: Extended Session Store (`src/participants/session-store.ts`)

Add two-slot storage for persistent roles:

```typescript
interface ParticipantSessionEntry {
  participantId: string;
  currentSessionId: string | null;   // active working session (branch)
  savedSessionId: string | null;     // checkpoint (golden state)
  lastUsedAt: string;                // ISO timestamp
}
```

Migration: on load, if existing entry has old format (`sessionId` field), migrate to `currentSessionId` with `savedSessionId: null`. No manual intervention needed.

Updated public API:

```typescript
// Read
getSession(participantId: string): { current: string | null; saved: string | null }

// Write
setCurrentSession(participantId: string, sessionId: string): Promise<void>
setSavedSession(participantId: string, sessionId: string): Promise<void>
clearCurrentSession(participantId: string): Promise<void>
clearSavedSession(participantId: string): Promise<void>
```

`getSession` returns both slots. Handler and API route use the same interface.

### D3: Updated Handler (`src/umsg/handler.ts`)

Update persistent role session logic:

```
Message arrives for persistent participant:
  → getSession(participantId)
  → has current?
      YES → resume current (no fork)
  → has saved but no current?
      YES → fork from saved (forkSession: true, resume: savedSessionId)
           → store result as current
  → has neither?
      → fresh session, store as current
```

Ephemeral roles: no change (always fresh, `persistSession: false`).

The key change: persistent roles now fork from saved when current doesn't exist, instead of always resuming the single session.

Add `forkSession` to `SdkQueryOptions` and pass it through to the SDK in `sdkQuery`.

### D4: Session Control API (`src/routes/session.ts`)

New route mounted at `/api/participants/:id/session`.

**GET** `/api/participants/:id/session` — read session state:
```json
{
  "participantId": "umsg-cto-o",
  "current": "session_abc123",
  "saved": "session_def456",
  "sessionPolicy": "persistent"
}
```

Returns `null` for empty slots. For ephemeral participants, returns `{ current: null, saved: null, sessionPolicy: "ephemeral" }`.

**POST** `/api/participants/:id/session` — session control action:

```json
{ "action": "save" }
```

Three actions:

| Action | Behavior | Response |
|--------|----------|----------|
| `save` | `saved = current`, `current = null`. Next message will fork from new saved. | `{ ok: true, saved: "<id>" }` |
| `delete-current` | `current = null`. Next message forks from saved (or fresh if no saved). | `{ ok: true }` |
| `delete-saved` | `saved = null`. Current continues as-is. | `{ ok: true }` |

Edge cases:
- `save` when no current: return `{ ok: false, error: "no current session" }`
- `delete-current` when no current: return `{ ok: true }` (idempotent)
- `delete-saved` when no saved: return `{ ok: true }` (idempotent)
- Action on ephemeral participant: return `{ ok: false, error: "ephemeral participants don't have session state" }`

Validate participant exists in config. Return 404 for unknown participant ID.

### D5: Wire Route to Server (`src/server.ts`)

Mount the new route:

```typescript
import { createSessionRoute } from "./routes/session";

app.route("/api/participants", createSessionRoute(participants));
```

The route factory receives the participants list for validation.

### D6: Updated sdkQuery (`src/sdk-query.ts`)

Add `forkSession` to `SdkQueryOptions`:

```typescript
export interface SdkQueryOptions {
  // ... existing fields ...
  forkSession?: boolean;
}
```

Pass through to SDK options when set. Only used by handler when forking from a saved checkpoint.

### D7: Tests (`src/participants/__tests__/session-store.test.ts`)

Test the session store:

1. Get empty state returns `{ current: null, saved: null }`
2. Set current, get returns it
3. Set saved, get returns both
4. Clear current, saved remains
5. Clear saved, current remains
6. Migration: old format `{ sessionId: "x" }` → `{ current: "x", saved: null }`

Test the handler session logic (mock sdkQuery):

1. Persistent role, no sessions → fresh session created, stored as current
2. Persistent role, has current → resume current (no fork)
3. Persistent role, has saved but no current → fork from saved
4. Ephemeral role → always fresh, no session stored

---

## What Changes, What Stays

| Component | Action |
|-----------|--------|
| `src/participants/session-store.ts` | Update — two-slot storage, migration |
| `src/umsg/handler.ts` | Update — fork-from-saved logic |
| `src/sdk-query.ts` | Update — add `forkSession` option |
| `src/routes/session.ts` | New — participant list + session control API |
| `src/server.ts` | Update — mount new route |
| `scripts/test-fork.ts` | New — SDK fork verification |
| `src/participants/__tests__/session-store.test.ts` | New — tests |
| `data/participant-sessions.json` | Auto-migrated — old entries get new format |

---

## UI Contract

For u-msg-ui to integrate, these are the API calls:

```
# Read session state for any participant
GET /api/participants/umsg-cto-o/session

# Save checkpoint (promote current → saved)
POST /api/participants/umsg-cto-o/session
{"action": "save"}

# Discard current branch (will fork from saved on next message)
POST /api/participants/umsg-cto-o/session
{"action": "delete-current"}

# Delete checkpoint (current continues, no more fork source)
POST /api/participants/umsg-cto-o/session
{"action": "delete-saved"}
```

# Read all participants
GET /api/participants

UI shows per persistent participant:
- **Current session** indicator (exists/doesn't) + delete button
- **Saved checkpoint** indicator (exists/doesn't) + delete button
- **Save button** — only enabled when current exists

---

## Acceptance Criteria

1. [ ] `scripts/test-fork.ts` confirms SDK fork works (or documents fallback). — script written, requires live run
2. [x] Session store supports two slots: `currentSessionId` and `savedSessionId`.
3. [x] Old session store format auto-migrates (no manual step).
4. [x] Persistent role with saved + no current → forks from saved on next message.
5. [x] Persistent role with current → resumes current (no fork).
6. [x] Persistent role with neither → fresh session.
7. [x] `POST .../session {"action":"save"}` promotes current to saved, clears current.
8. [x] `POST .../session {"action":"delete-current"}` clears current.
9. [x] `POST .../session {"action":"delete-saved"}` clears saved.
10. [x] `GET .../session` returns both slots + policy.
11. [x] Ephemeral participants return error on session control actions.
12. [x] `bun test` passes all new session store and handler tests. — 31/31 passing
13. [x] `forkSession: true` passed through sdkQuery to SDK.
14. [x] `GET /api/participants` returns id, role, model, sessionPolicy for all participants.
