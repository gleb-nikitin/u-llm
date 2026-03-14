# Spec 020: Session Save/Checkpoint (revised)

## Problem

Spec 020 v1 was wrong: handler auto-added ALL sessions to `sessions[]` via `setActiveSession`. No distinction between user-saved checkpoints and auto-created sessions. u-msg-ui needs explicit save/checkpoint semantics.

## Goal

Separate `active` (auto-managed by handler) from `saved[]` (explicit user checkpoints only). Saved sessions are immutable — handler always forks from them via SDK `forkSession: true`, never appends. Expose API for u-msg-ui to save, select, rename, and delete checkpoints.

## Data Model

### SavedSession
```typescript
interface SavedSession {
  id: string;           // SDK session UUID (snapshot at save time)
  label: string | null; // user-assigned label
  savedAt: string;      // ISO timestamp
}
```

### ParticipantSessionEntry (v4)
```typescript
interface ParticipantSessionEntry {
  participantId: string;
  active: string | null;     // current auto-managed session (handler sets this)
  saved: SavedSession[];     // only user-saved checkpoints
  lastUsedAt: string;
}
```

### Migration

Detection order (check fields to determine format):

- **V1** `{ sessionId }` → `active = sessionId`, `saved = []`
- **V2** `{ currentSessionId, savedSessionId }` → `active = currentSessionId`, `saved = savedSessionId ? [{ id: savedSessionId, label: null, savedAt: lastUsedAt }] : []`
- **V3** `{ activeSessionId, sessions: SessionSlot[] }` → `active = activeSessionId`, `saved = sessions.map(s => ({ id: s.id, label: s.label, savedAt: s.createdAt }))`
- **V4** `{ active, saved }` → already current format

## Session Store Changes (`src/participants/session-store.ts`)

### Remove
- `listSessions()` — saved sessions available via `getSession().saved`
- `switchSession()` — replaced by route-level validation + `setActive`

### Rename/Modify
- `setActiveSession(id, sessionId)` → `setActive(id, sessionId)`: just sets `active` pointer. Does NOT touch `saved[]`. No session list accumulation.
- `deleteSession()` → `deleteSaved(id, sessionId)`: removes from `saved[]` only. If deleted session was `active`, sets `active = null`.
- `labelSession()` → `labelSaved(id, sessionId, label)`: updates label in `saved[]`.
- `getSession(id)` → returns `{ active: string | null, saved: SavedSession[] }`
- `clearActive(id)` → unchanged semantics, sets `active = null`

### New
- `saveSession(id)` → takes current `active` and adds to `saved[]`. Returns `{ ok, error?, saved? }`.
  - Error if `active` is null (nothing to save)
  - If `active` already in `saved[]` → no-op, return existing entry
  - Does NOT clear `active` — handler continues using the same session until next fork

## Handler Changes (`src/umsg/handler.ts`)

### Key invariant
**Never append to a saved session.** If `active` is in `saved[]`, always fork.

### `resolveSessionOptions` (3 params now)
```typescript
function resolveSessionOptions(
  active: string | null,
  savedIds: string[],
  clear?: boolean,
): { resume?: string; forkSession?: boolean; persistSession: boolean } {
  const isSaved = active !== null && savedIds.includes(active);

  if (clear) {
    // Clear + saved checkpoint selected → fork from checkpoint
    if (isSaved) return { resume: active, forkSession: true, persistSession: true };
    // Clear + no checkpoint → completely fresh
    return { persistSession: true };
  }

  if (active) {
    // Active is a saved checkpoint → fork to protect it
    if (isSaved) return { resume: active, forkSession: true, persistSession: true };
    // Normal resume
    return { resume: active, persistSession: true };
  }

  // No active → fresh
  return { persistSession: true };
}
```

### Handler flow change
```
1. Read active + saved BEFORE any mutation
2. Compute session options (fork/resume/fresh)
3. SDK call with { resume, forkSession, persistSession }
4. setActive(participantId, result.sessionId)
```

Remove the `clearActive` call from the handler. The handler no longer mutates state before the SDK call. After the SDK call, `setActive` overwrites `active` with the result session (which is a new session for fork/fresh cases, same session for resume).

### After SDK call
```typescript
await setActive(participantId, result.sessionId);
```
Just updates active pointer. Never touches saved[].

### `forkSession` pass-through
Handler passes `forkSession` from resolveSessionOptions to sdkQuery options. Already supported in `SdkQueryOptions` and `sdk-query.ts`.

## API Changes (`src/routes/session.ts`)

### Modified
- `GET /api/participants` → session field: `{ active: string | null, saved: SavedSession[] }`
- `GET /api/participants/:id/session` → `{ participantId, active, saved }`

### New endpoint
- `POST /api/participants/:id/sessions/save` → saves current active to saved[]. Returns `{ ok, saved? }`. 400 if no active.

### Keep (adjusted semantics)
- `PUT /api/participants/:id/sessions/active` → `{ sessionId: string | null }` — sets active pointer. If sessionId is not null, must exist in `saved[]` (validated by route). If null, clears active.
- `PATCH /api/participants/:id/sessions/:sid` → `{ label: string }` — rename saved session
- `DELETE /api/participants/:id/sessions/:sid` → remove from saved[]

### Remove
- `GET /api/participants/:id/sessions` — saved sessions returned in main session response

## Test Updates (`src/participants/__tests__/session-store.test.ts`)

### Remove/Rewrite
- All tests that assume `setActiveSession` adds to a session list
- `switchSession` tests
- `listSessions` tests

### New/Updated tests

**Store:**
- `setActive` only sets pointer, does not create saved entries
- `saveSession` adds active to saved[], error if no active, no-op if already saved
- `deleteSaved` removes from saved[], clears active if was active
- `labelSaved` updates label in saved[]
- `clearActive` sets active to null
- Multiple participants independent

**Migration:**
- V1 `{ sessionId }` → active set, saved empty
- V2 `{ currentSessionId, savedSessionId }` → active + saved checkpoint
- V3 `{ activeSessionId, sessions }` → active + all sessions become saved

**resolveSessionOptions:**
- No active, no clear → fresh
- Active set, not saved → resume
- Active set, in saved → fork (forkSession: true)
- Clear + active in saved → fork from checkpoint
- Clear + active not saved → fresh
- Clear + no active → fresh

**Handler flow integration:**
- Fresh participant → fresh session → setActive
- Resume active → same session → setActive
- Active is saved → fork → new session becomes active, saved untouched
- Clear + saved selected → fork from saved → new active
- Clear + no saved → fresh → new active

**API:**
- POST /sessions/save → saves active, error if no active
- PUT /sessions/active → validates against saved[], 400 if not found
- PATCH /sessions/:sid → renames saved session
- DELETE /sessions/:sid → removes saved session
- GET /participants → session: { active, saved }

## Acceptance Criteria

- [x] AC1: Data model uses `{ active, saved: SavedSession[] }` — saved only populated by explicit save
- [x] AC2: Migration handles V1, V2, V3 formats → V4
- [x] AC3: `setActive` only sets pointer — handler never adds to saved[]
- [x] AC4: `POST /sessions/save` adds current active to saved[], error if no active
- [x] AC5: Handler forks (forkSession: true) when active is in saved[] — checkpoint immutable
- [x] AC6: Clear + saved selected → fork from checkpoint
- [x] AC7: Clear + no saved → completely fresh
- [x] AC8: `PUT /sessions/active` validates sessionId against saved[]
- [x] AC9: `DELETE /sessions/:sid` removes from saved[], clears active if was active
- [x] AC10: `PATCH /sessions/:sid` renames saved session label
- [x] AC11: `GET /api/participants` returns `{ active, saved }` in session field
- [x] AC12: All tests pass for store + handler + API (old tests rewritten)
- [x] AC13: Existing data migrates without loss on restart
