# Spec 019 — Notify-Only: No LLM Call, No Session Mutation

## Problem

When a message arrives with `notify: [A, B]` and `response_from: B`:
- Participant A enters the handler, runs a full SDK query, then **discards** the response (wasted tokens).
- If `meta.clear === true`, participant A's session is **wiped** — even though `clear` was intended for B.

Both behaviors are bugs. Notify-only participants should be passive observers.

## Intent

Notifications are a **lightweight inbox**, not an LLM trigger. When a participant is later active, it can search notification summaries and decide what to open. No processing at notification time.

## Changes

### 1. Skip LLM query for notify-only participants

In `src/umsg/handler.ts`, after the `isResponder` / `isNotified` check:
- If `!isResponder && isNotified`: log the notification and **return immediately**. No SDK query, no session mutation, no cost.

### 2. Scope `clear` to responder only

Move the `clearCurrentSession()` call **inside** the responder path. Notify-only participants must never have their sessions mutated by another participant's message.

### 3. Log notifications

When a notify-only message arrives, log a line to `data/notifications.log`:
```
{timestamp} | {participantId} | chain={chainId} | from={msg.from_id} | summary={msg.summary || first 100 chars of content}
```

This becomes the searchable inbox for later features.

### 4. Mark as read via u-msg

Still call `markRead(chainId, participantId)` for notify-only participants so u-msg knows they received it.

## Code Sketch

```typescript
// handler.ts — after line 84
const isResponder = msg.response_from === participantId;
const isNotified = msg.notify?.includes(participantId);
if (!isResponder && !isNotified) return;

// Notify-only: log and exit — no LLM call, no session mutation
if (!isResponder) {
  const summary = msg.summary || msg.content.slice(0, 100);
  const logLine = `${new Date().toISOString()} | ${participantId} | chain=${chainId} | from=${msg.from_id} | summary=${summary}\n`;
  try {
    const { appendFileSync } = await import("fs");
    const { join } = await import("path");
    appendFileSync(join(import.meta.dir, "..", "..", "data", "notifications.log"), logLine);
  } catch { /* non-critical */ }
  console.log(`[umsg:${participantId}] notification logged (no LLM call)`);
  await markRead(chainId, participantId);
  return;
}

// Only responder reaches here — clear is safe
const clear = msg.meta?.clear === true;
if (clear) {
  await clearCurrentSession(participantId);
}
```

## What Gets Removed

- The entire notify-only SDK query path (lines ~160-173 in current handler.ts)
- `data/discarded-replies.log` becomes dead — no more discarded replies. Can be deleted or kept for historical reference.

## Acceptance Criteria

- [x] Notify-only participant does NOT run an SDK query
- [x] Notify-only participant's session is NOT cleared by `meta.clear`
- [x] Notification logged to `data/notifications.log` with timestamp, participant, chain, from, summary
- [x] `markRead` still called for notify-only
- [x] Responder path unchanged — `clear`, SDK query, reply all work as before
- [x] Existing tests pass (update any that test the discarded-reply path)
- [ ] Manual test: send message with `notify: [cto]`, `response_from: exec`, `meta: {clear: true}` — verify CTO session untouched, no LLM cost

## Scope

Small. ~20 lines changed in handler.ts. One new log file. No API changes, no config changes.
