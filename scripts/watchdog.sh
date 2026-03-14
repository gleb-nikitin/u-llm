#!/bin/bash
#
# SDK Session Watchdog
# Monitors all active participants' Claude Code sessions
# Shows file size + token count from JSONL usage data
# Hard-stops all SDK processing when any session exceeds limits
#
# Usage: ./scripts/watchdog.sh
# Config: data/watchdog.json
# Sessions: data/participant-sessions.json
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WATCHDOG_CONFIG="$PROJECT_DIR/data/watchdog.json"
SESSIONS_FILE="$PROJECT_DIR/data/participant-sessions.json"

# Encoded CWD for Claude Code session path
ENCODED_CWD=$(echo "$PROJECT_DIR" | sed 's|/|-|g')
CLAUDE_SESSIONS_DIR="$HOME/.claude/projects/$ENCODED_CWD"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
DIM='\033[2m'
NC='\033[0m'

if [ ! -f "$WATCHDOG_CONFIG" ]; then
  echo "Config not found: $WATCHDOG_CONFIG"
  echo "Create it: bun scripts/init-watchdog.ts"
  exit 1
fi

if [ ! -f "$SESSIONS_FILE" ]; then
  echo "Sessions file not found: $SESSIONS_FILE"
  exit 1
fi

MAX_SIZE_MB=$(jq -r '.maxSizeMB' "$WATCHDOG_CONFIG")
MAX_TOKENS=$(jq -r '.maxTokens' "$WATCHDOG_CONFIG")
REFRESH_INTERVAL=$(jq -r '.refreshIntervalSeconds // 30' "$WATCHDOG_CONFIG")

echo "Watchdog started"
echo "  Limits: ${MAX_SIZE_MB} MB / $(printf "%'d" $MAX_TOKENS) tokens"
echo "  Interval: ${REFRESH_INTERVAL}s"
echo "  Ctrl+C to stop"
echo "---"
echo ""

get_tokens() {
  local jsonl_path="$1"
  grep '"type":"assistant"' "$jsonl_path" 2>/dev/null | tail -1 | \
    jq -r '.message.usage | (.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0)' 2>/dev/null || echo ""
}

stop_all() {
  local reason="$1"
  local now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  jq --arg reason "$reason" --arg now "$now" \
    '.stopped = true | .stoppedAt = $now | .stoppedReason = $reason' \
    "$WATCHDOG_CONFIG" > "$WATCHDOG_CONFIG.tmp" && mv "$WATCHDOG_CONFIG.tmp" "$WATCHDOG_CONFIG"

  echo ""
  echo -e "${RED}  ALL MESSAGES TO SDK ARE NOW BLOCKED.${NC}"
  echo "  Reason: $reason"
  echo ""
  echo "  Recovery prompt (copy and give to an agent):"
  echo ""
  echo "  -------"
  echo "  The watchdog stopped all SDK message processing."
  echo "  Reason: $reason"
  echo "  Stopped at: $now"
  echo ""
  echo "  Read data/watchdog.json for current state."
  echo "  Investigate what caused the bloat, then:"
  echo "  1. Set \"stopped\" to false in data/watchdog.json"
  echo "  2. Confirm the watchdog terminal shows OK status"
  echo "  -------"
  echo ""
}

while true; do
  CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$CURRENT_TIME]"
  echo ""

  # Re-read config each cycle (may have been unblocked)
  STOPPED=$(jq -r '.stopped' "$WATCHDOG_CONFIG")

  if [ "$STOPPED" = "true" ]; then
    REASON=$(jq -r '.stoppedReason // "unknown"' "$WATCHDOG_CONFIG")
    echo -e "  ${RED}BLOCKED${NC} — $REASON"
    echo -e "  ${DIM}Unblock: jq '.stopped = false | .stoppedAt = null | .stoppedReason = null' data/watchdog.json > tmp && mv tmp data/watchdog.json${NC}"
    echo ""
    sleep "$REFRESH_INTERVAL"
    continue
  fi

  # Read participant IDs and session IDs
  # Support V4 (active), V3 (activeSessionId), V2 (currentSessionId), V1 (sessionId) formats
  PARTICIPANTS=$(jq -r 'to_entries[] | "\(.key)|\(.value.active // .value.activeSessionId // .value.currentSessionId // .value.sessionId // "")"' "$SESSIONS_FILE" 2>/dev/null)

  if [ -z "$PARTICIPANTS" ]; then
    echo "  No active participants"
    echo ""
    sleep "$REFRESH_INTERVAL"
    continue
  fi

  TRIGGERED=""

  while IFS='|' read -r PID SID; do
    if [ -z "$SID" ] || [ "$SID" = "null" ]; then
      echo -e "  ${DIM}$PID${NC}    --    no active session"
      continue
    fi

    JSONL_PATH="$CLAUDE_SESSIONS_DIR/$SID.jsonl"

    if [ ! -f "$JSONL_PATH" ]; then
      echo -e "  ${DIM}$PID${NC}    --    session file not found"
      continue
    fi

    # File size
    SIZE_BYTES=$(stat -f%z "$JSONL_PATH" 2>/dev/null || stat -c%s "$JSONL_PATH" 2>/dev/null || echo 0)
    SIZE_MB=$(echo "scale=2; $SIZE_BYTES / 1048576" | bc)

    # Token count
    TOKENS=$(get_tokens "$JSONL_PATH")

    # Determine status
    STATUS="OK"
    STATUS_COLOR="$GREEN"
    EXTRA=""

    if [ -n "$TOKENS" ] && [ "$TOKENS" != "null" ] && [ "$TOKENS" -gt 0 ] 2>/dev/null; then
      TOKEN_PCT=$(echo "scale=1; $TOKENS * 100 / $MAX_TOKENS" | bc)
      REMAINING=$((MAX_TOKENS - TOKENS))
      TOKEN_STR="$(printf "%'d" $TOKENS) / $(printf "%'d" $MAX_TOKENS) (${TOKEN_PCT}%)    remaining: $(printf "%'d" $REMAINING)"

      # Check token limit
      if (( TOKENS > MAX_TOKENS )); then
        STATUS="STOPPED"
        STATUS_COLOR="$RED"
        TRIGGERED="$PID exceeded $(printf "%'d" $MAX_TOKENS) token limit (current: $(printf "%'d" $TOKENS))"
      elif (( $(echo "$TOKENS > $MAX_TOKENS * 0.8" | bc -l) )); then
        STATUS="WARN"
        STATUS_COLOR="$YELLOW"
      fi
    else
      TOKEN_STR="tokens: n/a"
    fi

    # Check size limit
    if (( $(echo "$SIZE_MB > $MAX_SIZE_MB" | bc -l) )); then
      STATUS="STOPPED"
      STATUS_COLOR="$RED"
      TRIGGERED="$PID exceeded ${MAX_SIZE_MB} MB size limit (current: ${SIZE_MB} MB)"
    elif [ "$STATUS" = "OK" ] && (( $(echo "$SIZE_MB > $MAX_SIZE_MB * 0.8" | bc -l) )); then
      STATUS="WARN"
      STATUS_COLOR="$YELLOW"
    fi

    printf "  ${STATUS_COLOR}%-16s %-7s${NC} %s MB / %s MB    %s\n" "$PID" "$STATUS" "$SIZE_MB" "$MAX_SIZE_MB" "$TOKEN_STR"

  done <<< "$PARTICIPANTS"

  # If any participant triggered a stop
  if [ -n "$TRIGGERED" ]; then
    stop_all "$TRIGGERED"
  fi

  echo ""
  sleep "$REFRESH_INTERVAL"
done
