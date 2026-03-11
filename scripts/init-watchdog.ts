#!/usr/bin/env bun
/**
 * Initialize watchdog configuration
 * Usage: bun scripts/init-watchdog.ts <sessionPath> <maxSizeMB> [refreshSeconds]
 * Example: bun scripts/init-watchdog.ts data/sessions/u-llm_exec/sess-abc/current.jsonl 1.5 30
 */

import { join } from "path";
import { writeFileSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "data");
const WATCHDOG_CONFIG = join(DATA_DIR, "watchdog.json");

interface WatchdogConfig {
  enabled: boolean;
  sessionId: string;
  sessionPath: string;
  maxSizeMB: number;
  refreshIntervalSeconds: number;
  stopped: boolean;
  createdAt: string;
}

function initWatchdog(sessionPath: string, maxSizeMB: string, refreshSeconds?: string) {
  // Extract session ID from path
  // Example: data/sessions/u-llm_exec/sess-abc-123/current.jsonl
  const parts = sessionPath.split("/");
  const sessionId = parts[parts.length - 2] || "unknown";

  const config: WatchdogConfig = {
    enabled: true,
    sessionId,
    sessionPath,
    maxSizeMB: parseFloat(maxSizeMB),
    refreshIntervalSeconds: refreshSeconds ? parseInt(refreshSeconds) : 30,
    stopped: false,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(WATCHDOG_CONFIG, JSON.stringify(config, null, 2) + "\n");

  console.log("✅ Watchdog config created:");
  console.log(`   Path: ${WATCHDOG_CONFIG}`);
  console.log(`   Session ID: ${config.sessionId}`);
  console.log(`   Session Path: ${sessionPath}`);
  console.log(`   Max Size: ${config.maxSizeMB}MB`);
  console.log(`   Check Interval: ${config.refreshIntervalSeconds}s`);
  console.log("");
  console.log("Next: Run the watchdog script:");
  console.log("  chmod +x scripts/watchdog.sh");
  console.log("  ./scripts/watchdog.sh");
}

// Main
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: bun scripts/init-watchdog.ts <sessionPath> <maxSizeMB> [refreshSeconds]");
  console.error("Example: bun scripts/init-watchdog.ts data/sessions/u-llm_exec/sess-abc/current.jsonl 1.5 30");
  process.exit(1);
}

initWatchdog(args[0], args[1], args[2]);
