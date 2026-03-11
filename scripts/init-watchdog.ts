#!/usr/bin/env bun
/**
 * Initialize watchdog configuration
 * Usage: bun scripts/init-watchdog.ts [--max-size 1.5] [--max-tokens 150000] [--interval 30]
 */

import { join } from "path";
import { writeFileSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "data");
const WATCHDOG_CONFIG = join(DATA_DIR, "watchdog.json");

interface WatchdogConfig {
  maxSizeMB: number;
  maxTokens: number;
  refreshIntervalSeconds: number;
  stopped: boolean;
  stoppedAt: string | null;
  stoppedReason: string | null;
}

function parseArgs(args: string[]): { maxSize: number; maxTokens: number; interval: number } {
  let maxSize = 1.5;
  let maxTokens = 150000;
  let interval = 30;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--max-size" && args[i + 1]) {
      maxSize = parseFloat(args[++i]);
    } else if (args[i] === "--max-tokens" && args[i + 1]) {
      maxTokens = parseInt(args[++i]);
    } else if (args[i] === "--interval" && args[i + 1]) {
      interval = parseInt(args[++i]);
    }
  }

  return { maxSize, maxTokens, interval };
}

const args = process.argv.slice(2);
const { maxSize, maxTokens, interval } = parseArgs(args);

const config: WatchdogConfig = {
  maxSizeMB: maxSize,
  maxTokens: maxTokens,
  refreshIntervalSeconds: interval,
  stopped: false,
  stoppedAt: null,
  stoppedReason: null,
};

writeFileSync(WATCHDOG_CONFIG, JSON.stringify(config, null, 2) + "\n");

console.log("Watchdog config created:");
console.log(`  Path: ${WATCHDOG_CONFIG}`);
console.log(`  Max Size: ${config.maxSizeMB} MB`);
console.log(`  Max Tokens: ${config.maxTokens.toLocaleString()}`);
console.log(`  Interval: ${config.refreshIntervalSeconds}s`);
console.log("");
console.log("Launch watchdog:");
console.log("  ./scripts/watchdog.sh");
