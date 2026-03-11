# Watchdog Operator Guide

## Overview

The watchdog monitors all active Claude Code SDK sessions for file size and token usage. When any session exceeds configured limits, it triggers a global hard-stop that blocks all SDK message processing until manually cleared.

## Quick Start

### 1. Initialize Watchdog Config

Copy and paste this command (works from any folder):

```bash
cd /Users/glebnikitin/work/code/u-llm && bun scripts/init-watchdog.ts --max-size 500 --max-tokens 50000 --interval 30
```

**Options:**
- `--max-size` — size limit in MB (default: 500)
- `--max-tokens` — token limit per session (default: 50000)
- `--interval` — check interval in seconds (default: 30)

**Example: higher limits for longer sessions**
```bash
cd /Users/glebnikitin/work/code/u-llm && bun scripts/init-watchdog.ts --max-size 1000 --max-tokens 100000
```

### 2. Launch Watchdog

Copy and paste this command in a dedicated terminal:

```bash
cd /Users/glebnikitin/work/code/u-llm && ./scripts/watchdog.sh
```

**Runs from any directory** — the script auto-detects the project root.

### 3. Monitor Output

The watchdog displays in real-time:
- Participant ID and session status (OK / WARN / STOPPED)
- Current file size and limit (MB)
- Current token count and limit with percentage used

Example output:
```
[2026-03-11 15:30:45]

  u-llm_exec       OK       42.3 MB / 500 MB    32,450 / 50,000 (64%)    remaining: 17,550
  u-llm_cto        OK       18.7 MB / 500 MB    tokens: n/a
  u-llm_audit      WARN     420.0 MB / 500 MB   48,900 / 50,000 (97%)    remaining: 1,100

---
```

## If Watchdog Triggers (STOPPED)

When a session exceeds limits, the watchdog:
1. Sets `"stopped": true` in `data/watchdog.json`
2. Blocks all SDK queries from executing (zero overhead in handler.ts)
3. Prints a recovery prompt (copy this for the agent)

Example blocked output:
```
[2026-03-11 15:31:15]

  BLOCKED — u-llm_exec exceeded 50,000 token limit (current: 52,330)

  Recovery prompt (copy and give to an agent):

  -------
  The watchdog stopped all SDK message processing.
  Reason: u-llm_exec exceeded 50,000 token limit (current: 52,330)
  Stopped at: 2026-03-11T15:31:15Z

  Read data/watchdog.json for current state.
  Investigate what caused the bloat, then:
  1. Set "stopped" to false in data/watchdog.json
  2. Confirm the watchdog terminal shows OK status
  -------
```

## Recovery Steps

### When Watchdog Has Blocked All Messages

**1. Copy the recovery prompt** — The watchdog terminal shows it above.

**2. Give it to an agent** — Paste the prompt into Claude Code and ask the agent to:
   - Read `data/watchdog.json` to see which participant hit the limit
   - Investigate the session (check `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`)
   - Determine what caused the bloat (stuck loop? large file reads?)

**3. Fix the root cause** — The agent should:
   - Unblock one participant at a time (edit `data/watchdog.json`: set `stopped` to `false`)
   - Test that participant separately
   - Return to watchdog terminal — it should show OK status

**4. Clear limits when safe** — After root cause is fixed, update limits:

```bash
cd /Users/glebnikitin/work/code/u-llm && bun scripts/init-watchdog.ts --max-size 1000 --max-tokens 100000
```

Then restart the watchdog terminal (Ctrl+C and run the launch command again).

## Understanding the Config

`data/watchdog.json`:

```json
{
  "maxSizeMB": 500,
  "maxTokens": 50000,
  "refreshIntervalSeconds": 30,
  "stopped": false,
  "stoppedAt": null,
  "stoppedReason": null
}
```

- `maxSizeMB` — hard limit for session file size
- `maxTokens` — hard limit for token usage (from SDK JSONL usage data)
- `refreshIntervalSeconds` — how often watchdog checks (lower = faster response, higher = less overhead)
- `stopped` — if `true`, all SDK queries are blocked
- `stoppedAt` — timestamp when block was triggered
- `stoppedReason` — human-readable reason for the block

## Manual Unblock (if needed)

If you need to unblock manually without waiting for recovery, copy and paste:

```bash
cd /Users/glebnikitin/work/code/u-llm && jq '.stopped = false | .stoppedAt = null | .stoppedReason = null' data/watchdog.json > tmp && mv tmp data/watchdog.json
```

Then check the watchdog terminal — it should show OK status again (within 30s of the next check).

## How It Works

1. **Watches:** `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` for each active participant
2. **Extracts tokens from:** Last `"type":"assistant"` message's `usage` field (zero API calls — pure file read)
3. **Checks every 30s:** Against `maxSizeMB` and `maxTokens`
4. **On breach:** Sets `stopped: true` in `data/watchdog.json` (non-blocking write)
5. **Handler checks:** `src/watchdog.ts` reads `stopped` flag with 5-second cache
6. **Result:** No new SDK queries accepted until manually unblocked

## Troubleshooting

**"Config not found"**
→ Run `bun scripts/init-watchdog.ts` first

**"Sessions file not found"**
→ Start the u-llm service first: `bun run dev`

**"session file not found"** (dimmed in output)
→ That participant has no active session yet (normal)

**"tokens: n/a"** (dimmed in output)
→ Token data not yet available in session JSONL (normal for new sessions)

**Watchdog not blocking even though size/tokens are high**
→ Check `refreshIntervalSeconds` in config (may take up to that long to trigger)

**Want to change limits without restart**
→ Edit `data/watchdog.json` directly (or re-run init-watchdog.ts with new values)

## All Commands Work From Any Directory

Copy and paste these from any terminal location:

**Start watchdog:**
```bash
cd /Users/glebnikitin/work/code/u-llm && ./scripts/watchdog.sh
```

**Initialize config:**
```bash
cd /Users/glebnikitin/work/code/u-llm && bun scripts/init-watchdog.ts --max-size 500 --max-tokens 50000
```

**Manual unblock:**
```bash
cd /Users/glebnikitin/work/code/u-llm && jq '.stopped = false | .stoppedAt = null | .stoppedReason = null' data/watchdog.json > tmp && mv tmp data/watchdog.json
```

**Why this works:** Scripts internally resolve the project directory from their own location, so they work from any terminal folder. The `cd` at the start ensures file paths (like `data/watchdog.json`) are resolved correctly.
