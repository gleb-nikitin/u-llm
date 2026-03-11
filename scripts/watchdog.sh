#!/bin/bash
#
# Simple Session Watchdog
# Monitors session file size every N seconds
# Hard-stops session when it exceeds size limit
#
# Usage: ./scripts/watchdog.sh
# Configuration: data/watchdog.json
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WATCHDOG_CONFIG="$PROJECT_DIR/data/watchdog.json"

# Colors for terminal output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Ensure config file exists
if [ ! -f "$WATCHDOG_CONFIG" ]; then
  echo "❌ Config file not found: $WATCHDOG_CONFIG"
  echo "Create it with: bun scripts/init-watchdog.ts <sessionPath> <maxSizeMB>"
  exit 1
fi

# Load config
SESSION_PATH=$(jq -r '.sessionPath' "$WATCHDOG_CONFIG")
MAX_SIZE_MB=$(jq -r '.maxSizeMB' "$WATCHDOG_CONFIG")
REFRESH_INTERVAL=$(jq -r '.refreshIntervalSeconds // 30' "$WATCHDOG_CONFIG")
SESSION_ID=$(jq -r '.sessionId' "$WATCHDOG_CONFIG")

echo "🔍 Watchdog started"
echo "   Session ID: $SESSION_ID"
echo "   Path: $SESSION_PATH"
echo "   Max size: ${MAX_SIZE_MB}MB"
echo "   Check interval: ${REFRESH_INTERVAL}s"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo "---"
echo ""

LAST_SIZE=0
LAST_CHECK=$(date +%s)

while true; do
  CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')

  if [ ! -f "$SESSION_PATH" ]; then
    echo -e "${YELLOW}[$CURRENT_TIME]${NC} File not found: $SESSION_PATH"
  else
    # Get file size in bytes
    SIZE_BYTES=$(stat -f%z "$SESSION_PATH" 2>/dev/null || stat -c%s "$SESSION_PATH" 2>/dev/null || echo 0)
    SIZE_MB=$(echo "scale=2; $SIZE_BYTES / 1048576" | bc)

    # Calculate growth rate (MB/min)
    CURRENT_TIME_SEC=$(date +%s)
    TIME_DIFF=$((CURRENT_TIME_SEC - LAST_CHECK))
    if [ $TIME_DIFF -gt 0 ]; then
      SIZE_DIFF=$(echo "scale=3; ($SIZE_MB - $LAST_SIZE) * 60 / $TIME_DIFF" | bc)
    else
      SIZE_DIFF=0
    fi

    # Check status
    THRESHOLD_80=$(echo "scale=2; $MAX_SIZE_MB * 0.8" | bc)

    if (( $(echo "$SIZE_MB > $MAX_SIZE_MB" | bc -l) )); then
      # STOPPED
      echo -e "${RED}[$CURRENT_TIME] 🛑 STOPPED${NC}"
      echo "   Size: $SIZE_MB MB (limit: ${MAX_SIZE_MB}MB)"
      echo "   Growth: ${SIZE_DIFF}MB/min"

      # Mark as stopped in config
      jq '.stopped = true' "$WATCHDOG_CONFIG" > "$WATCHDOG_CONFIG.tmp" && \
        mv "$WATCHDOG_CONFIG.tmp" "$WATCHDOG_CONFIG"

      echo ""
      echo "⛔ Session is now STOPPED. Messages from u-msg will be rejected."
      echo "   To unblock:"
      echo "   1. Clear problematic messages from u-msg"
      echo "   2. Run: jq '.stopped = false' $WATCHDOG_CONFIG > $WATCHDOG_CONFIG.tmp && mv $WATCHDOG_CONFIG.tmp $WATCHDOG_CONFIG"
      echo ""

    elif (( $(echo "$SIZE_MB > $THRESHOLD_80" | bc -l) )); then
      # WARNING
      echo -e "${YELLOW}[$CURRENT_TIME] ⚠️  WARNING${NC}"
      echo "   Size: $SIZE_MB MB (limit: ${MAX_SIZE_MB}MB, 80% = ${THRESHOLD_80}MB)"
      echo "   Growth: ${SIZE_DIFF}MB/min"
    else
      # OK
      echo -e "${GREEN}[$CURRENT_TIME] ✅ OK${NC}"
      echo "   Size: $SIZE_MB MB (limit: ${MAX_SIZE_MB}MB)"
      echo "   Growth: ${SIZE_DIFF}MB/min"
    fi

    LAST_SIZE=$SIZE_MB
    LAST_CHECK=$CURRENT_TIME_SEC
  fi

  echo ""
  sleep "$REFRESH_INTERVAL"
done
