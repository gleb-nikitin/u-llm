# Spec 012: Simple Watchdog — Session Size & Growth Rate Monitoring

## Goal
Prevent uncontrolled session file growth that causes context bloat and service crashes. Provide semi-manual watchdog that monitors session size, alerts when approaching limits, and hard-stops session message intake when limit exceeded.

## Context
- Session files can balloon from chain context consumption (observed: 4MB in 10 minutes)
- Need to detect and stop runaway growth before it crashes the service
- Solution: Simple bash script that monitors file size every 30s + manual control file

## Deliverables
| File | Action | Purpose |
|------|--------|---------|
| `scripts/find-session.ts` | Create | Tool to locate session file by participant ID |
| `scripts/init-watchdog.ts` | Create | Initialize watchdog config for a session |
| `scripts/watchdog.sh` | Create | Terminal script (runs every 30s) that monitors size |
| `data/watchdog.json` | Create | Config file (size limit, session path, status) |
| `src/umsg/handler.ts` | Modify | Check watchdog `stopped` flag before processing messages |
| `agent/specs/012-watchdog.md` | Create | This spec |

## How It Works

### 1. Find Session Location
```bash
bun scripts/find-session.ts u-llm_cto
# Output:
# 📍 Session Location for u-llm_cto
# Current Session:
#   ID: eea1f950-...
#   Path: /Users/.../data/sessions/u-llm_cto/eea1f950-.../current.jsonl
#   Size: 1.1 MB
#   Status: ✅ Active
```

### 2. Initialize Watchdog
```bash
bun scripts/init-watchdog.ts "data/sessions/u-llm_cto/eea1f950-.../current.jsonl" 1.5 30
# Creates data/watchdog.json:
# {
#   "enabled": true,
#   "sessionId": "eea1f950-...",
#   "sessionPath": "data/sessions/u-llm_cto/eea1f950-.../current.jsonl",
#   "maxSizeMB": 1.5,
#   "refreshIntervalSeconds": 30,
#   "stopped": false
# }
```

### 3. Run Watchdog Script
```bash
chmod +x scripts/watchdog.sh
./scripts/watchdog.sh
```

Terminal output:
```
🔍 Watchdog started
   Session ID: eea1f950-...
   Path: /Users/.../data/sessions/u-llm_cto/eea1f950-.../current.jsonl
   Max size: 1.5MB
   Check interval: 30s

[2026-03-11 14:35:22] ✅ OK
   Size: 0.8 MB (limit: 1.5MB)
   Growth: 0.5MB/min

[2026-03-11 14:35:52] ✅ OK
   Size: 0.82 MB (limit: 1.5MB)
   Growth: 0.4MB/min

[2026-03-11 14:36:22] ⚠️ WARNING
   Size: 1.25 MB (limit: 1.5MB, 80% = 1.2MB)
   Growth: 2.1MB/min

[2026-03-11 14:36:52] 🛑 STOPPED
   Size: 1.6 MB (limit: 1.5MB)
   Growth: 4.2MB/min
   ⛔ Session is now STOPPED. Messages from u-msg will be rejected.
```

### 4. Hard-Stop Mechanism
When watchdog detects size > limit:
1. Sets `stopped: true` in `data/watchdog.json`
2. Handler checks flag before processing messages (in `src/umsg/handler.ts`):
```typescript
const watchdog = loadWatchdogConfig(); // reads data/watchdog.json
if (watchdog.stopped) {
  console.log("[watchdog] ⛔ Session is stopped");
  return; // Don't process this message
}
```
3. Messages from u-msg are silently dropped (not queued)

### 5. Semi-Manual Unblock (C1 Approach)
When you've cleared problematic messages from the chain:

```bash
# Option 1: Edit manually
jq '.stopped = false' data/watchdog.json > data/watchdog.json.tmp && \
  mv data/watchdog.json.tmp data/watchdog.json

# Option 2: Watchdog script shows you the command
# Just copy and run it from the terminal where watchdog is running

# Option 3: Use find-session to verify size has dropped
bun scripts/find-session.ts u-llm_cto
# You'll see: Size: 0.9 MB (down from 1.6 MB)
```

Once unblocked, watchdog returns to monitoring and messages flow normally.

## Configuration

**data/watchdog.json:**
```json
{
  "enabled": true,
  "sessionId": "eea1f950-4607-400d-aebb-d798074777f9",
  "sessionPath": "data/sessions/u-llm_cto/eea1f950-4607-400d-aebb-d798074777f9/current.jsonl",
  "maxSizeMB": 1.5,
  "refreshIntervalSeconds": 30,
  "stopped": false,
  "createdAt": "2026-03-11T14:30:00.000Z"
}
```

**Parameters:**
- `maxSizeMB`: Hard limit (default: 1.5). Session hard-stops when exceeded.
- `refreshIntervalSeconds`: Check frequency (default: 30s).
- `stopped`: Set by watchdog when limit hit. Set to `false` to unblock.

## Behavior

| State | Size | Growth | Action |
|-------|------|--------|--------|
| OK | < 80% of limit | Any | Monitor, accept messages |
| WARNING | 80-100% of limit | Any | Alert in terminal, accept messages |
| STOPPED | > limit | Any | Alert, set `stopped: true`, reject messages |

**Growth Rate:** Calculated as MB/min. Not used for stopping (only size), but displayed for visibility.

## Constraints
- **Semi-manual:** You must manually unblock by editing config or running command
- **Simple:** No database, no network calls, just file size checks
- **Terminal-based:** Meant for development/ops monitoring in a shell
- **Synchronous:** Handler checks flag before processing (no async)

## Acceptance Criteria
- [ ] 1. `bun scripts/find-session.ts <participant>` shows session location and size
- [ ] 2. `bun scripts/init-watchdog.ts <path> <maxMB>` creates config
- [ ] 3. `./scripts/watchdog.sh` monitors size every 30s, shows status
- [ ] 4. When size > limit, watchdog sets `stopped: true` in config
- [ ] 5. Handler checks watchdog config and rejects messages when `stopped: true`
- [ ] 6. Manual unblock: edit config to `stopped: false` → messages accepted again
- [ ] 7. Terminal output shows: timestamp, size, growth rate, status (OK/WARNING/STOPPED)
- [ ] 8. All existing tests (46) continue to pass
- [ ] 9. Watchdog config persists across restarts

## Verification
```bash
# 1. Find current CTO session
bun scripts/find-session.ts u-llm_cto
# → Shows path, size, status

# 2. Initialize watchdog (adjust maxSizeMB based on current size)
bun scripts/init-watchdog.ts "data/sessions/u-llm_cto/[sessionId]/current.jsonl" 1.5 30

# 3. Run watchdog in terminal
chmod +x scripts/watchdog.sh
./scripts/watchdog.sh
# → Shows: [timestamp] ✅ OK / ⚠️ WARNING / 🛑 STOPPED

# 4. Test hard-stop: write large message to session file
# (manually create a big JSONL entry)

# 5. Watch watchdog transition to STOPPED
# → Messages from u-msg are now rejected

# 6. Test unblock: clear the large entry, run:
jq '.stopped = false' data/watchdog.json > data/watchdog.json.tmp && \
  mv data/watchdog.json.tmp data/watchdog.json

# 7. Watchdog returns to OK, messages flow again

# 8. All 46 tests still pass
bun test
```

## Notes
- **Why not auto-recovery?** Manual control gives you visibility. You decide when to unblock.
- **Why check on every message?** We want to hard-stop immediately, not after next check interval.
- **Why bash script?** Simple, visible in terminal, easy to understand and modify.
- **Future enhancement:** Could add Slack/Discord alerts, automatic cleanup strategies, etc.

## Related Files
- `src/umsg/handler.ts` — Checks watchdog flag before processing messages
- `data/watchdog.json` — Runtime config (created by init-watchdog.ts)
- `data/participant-sessions.json` — Maps participants to session IDs (used by find-session.ts)
