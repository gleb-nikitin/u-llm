# Spec 013: Watchdog Token Visibility

## Goal
Rewrite the watchdog (spec 012) to monitor Claude Code SDK session JSONL files with token counting. Show real context window usage alongside file size. Global hard-stop when any session exceeds limits.

## Context
- Spec 012 monitors arbitrary file size in MB — opaque proxy for actual context load
- Claude Code SDK session JSONL files (at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`) contain `usage` data in every assistant message
- `usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens` = total context window consumption at that turn
- Session IDs are stored in `data/participant-sessions.json` — watchdog can auto-discover paths
- Verified: CTO session `eea1f950-...` shows 102,748 tokens from usage field. Works with `grep + jq`.
- Use case: running SDK tests, don't want a session to go insane and burn all context in minutes

## How Token Extraction Works (No API Calls)

Every `type: "assistant"` line in Claude Code session JSONL:
```json
{
  "type": "assistant",
  "message": {
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 512,
      "cache_read_input_tokens": 102233,
      "output_tokens": 1
    }
  }
}
```

Total context = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`

The last assistant message's usage IS the current session memory size. Extraction:
```bash
grep '"type":"assistant"' "$JSONL_PATH" | tail -1 | \
  jq '.message.usage | (.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0)'
```

## Deliverables

| File | Action | Purpose |
|------|--------|---------|
| `scripts/watchdog.sh` | Rewrite | Monitor SDK sessions from participant-sessions.json, show tokens |
| `scripts/init-watchdog.ts` | Rewrite | Simplified: set limits only (no session path — auto-discovered) |
| `data/watchdog.json` | New format | Limits + global stopped flag |
| `src/watchdog.ts` | Keep | `isSessionStopped()` unchanged — checks `data/watchdog.json` `stopped` field |
| `src/umsg/handler.ts` | Keep | Already calls `isSessionStopped()` before processing — no changes needed |
| `agent/human-watchdog.md` | Rewrite | Updated operator instructions + recovery prompt |

## Config Format (data/watchdog.json)

```json
{
  "maxSizeMB": 1.5,
  "maxTokens": 150000,
  "refreshIntervalSeconds": 30,
  "stopped": false,
  "stoppedAt": null,
  "stoppedReason": null
}
```

- `maxSizeMB`: file size hard limit
- `maxTokens`: token count hard limit (context window = 200K; 150K default leaves room for response + system)
- `stopped`: global flag — when true, ALL messages to SDK are rejected
- `stoppedAt`: ISO timestamp when stop was triggered (for recovery agent context)
- `stoppedReason`: human-readable reason (e.g., "u-llm_exec exceeded 150,000 token limit (current: 162,340)")

## Session Path Auto-Discovery

Watchdog reads `data/participant-sessions.json` to get session IDs, then constructs JSONL paths:

```
~/.claude/projects/-Users-glebnikitin-work-code-u-llm/<sessionId>.jsonl
```

The encoded CWD prefix is derived from the project directory (replace non-alphanumeric with `-`).

No manual path configuration needed. Watchdog monitors ALL participants that have a `currentSessionId`.

## watchdog.sh Output

```
Watchdog started
  Limits: 1.5 MB / 150,000 tokens
  Monitoring: 3 participants
  Interval: 30s
  Press Ctrl+C to stop
---

[2026-03-11 14:35:22]

  u-llm_cto    OK    0.71 MB / 1.5 MB    102,748 / 150,000 (68.5%)    remaining: 47,252
  u-llm_exec   OK    0.32 MB / 1.5 MB     41,200 / 150,000 (27.5%)    remaining: 108,800
  u-llm_audit  OK    0.18 MB / 1.5 MB     22,100 / 150,000 (14.7%)    remaining: 127,900

[2026-03-11 14:35:52]

  u-llm_cto    OK    0.73 MB / 1.5 MB    104,120 / 150,000 (69.4%)    remaining: 45,880
  u-llm_exec   WARN  1.21 MB / 1.5 MB    138,900 / 150,000 (92.6%)    remaining: 11,100
  u-llm_audit  OK    0.18 MB / 1.5 MB     22,100 / 150,000 (14.7%)    remaining: 127,900

[2026-03-11 14:36:22]

  u-llm_exec   STOPPED (token limit: 155,200 > 150,000)

  ALL MESSAGES TO SDK ARE NOW BLOCKED.
  Reason: u-llm_exec exceeded 150,000 token limit (current: 155,200)
  To recover, give an agent this prompt:

  -------
  The watchdog stopped all SDK message processing.
  Reason: u-llm_exec exceeded 150,000 token limit (current: 155,200).
  Stopped at: 2026-03-11T14:36:22Z

  Read data/watchdog.json for current state.
  Investigate what caused the bloat, then:
  1. Set "stopped" to false in data/watchdog.json
  2. Confirm the watchdog terminal shows OK status
  -------
```

### Status rules
- `OK`: both size and tokens within limits
- `WARN`: either metric > 80% of limit
- `STOPPED`: either metric exceeds limit → set global `stopped: true`, write reason

### When a participant has no session
If `currentSessionId` is null or JSONL file doesn't exist, show:
```
  u-llm_audit  --    no active session
```

### Token parsing failure
If JSONL exists but has no assistant messages or jq fails:
```
  u-llm_exec   OK    0.32 MB / 1.5 MB    tokens: n/a
```

## init-watchdog.ts

Simplified interface — no session paths needed:

```bash
bun scripts/init-watchdog.ts [--max-size 1.5] [--max-tokens 150000] [--interval 30]
```

Creates/overwrites `data/watchdog.json` with defaults. All parameters optional.

## handler.ts — No Changes

Current code already does what we need:
```typescript
if (isSessionStopped()) {
  console.log(`[umsg:${participantId}] Session is stopped by watchdog, rejecting message`);
  return;
}
```

`isSessionStopped()` reads `data/watchdog.json` and checks `stopped === true`. This is a global stop — exactly what we want.

## human-watchdog.md — Rewrite

Updated to reflect new config format, token display, and recovery procedure. Includes:
1. How to launch watchdog in terminal
2. What the output means
3. Recovery prompt to give an agent when watchdog stops

### Recovery Prompt (included in human-watchdog.md)

When watchdog stops, the operator copies this prompt and gives it to an agent:

```
The watchdog stopped all SDK message processing.
Reason: [REASON FROM WATCHDOG OUTPUT]
Stopped at: [TIMESTAMP]

Read data/watchdog.json for current state.
Investigate what caused the bloat, then:
1. Set "stopped" to false in data/watchdog.json
2. Confirm the watchdog terminal shows OK status
```

The watchdog.sh will print this prompt pre-filled with the actual reason and timestamp, so the operator just copies it.

## Acceptance Criteria

1. [ ] `watchdog.sh` reads participant-sessions.json, auto-discovers SDK session JSONL paths
2. [ ] Displays token count per participant extracted from JSONL usage data (no API calls)
3. [ ] Displays file size, token count, fill %, remaining tokens per participant
4. [ ] Sets `stopped: true` in watchdog.json when any participant exceeds size OR token limit
5. [ ] Writes `stoppedReason` and `stoppedAt` to watchdog.json for recovery context
6. [ ] `init-watchdog.ts` creates config with defaults (no session path args needed)
7. [ ] `handler.ts` + `watchdog.ts` unchanged — existing global stop mechanism works
8. [ ] Handles missing JSONL, no sessions, parse failures gracefully
9. [ ] `human-watchdog.md` rewritten with launch instructions and recovery prompt
10. [ ] All existing tests continue to pass

## Out of Scope
- Per-participant stop (global stop is simpler and safer)
- Auto-recovery or auto-compaction
- Token-based growth rate
- Web UI for watchdog status
- Alerts (Slack, Discord)
