/**
 * Watchdog configuration loader
 * Checks if session is in "stopped" state due to size limits
 */

import { join } from "path";
import { existsSync, readFileSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "data");
const WATCHDOG_CONFIG_FILE = join(DATA_DIR, "watchdog.json");

export interface WatchdogConfig {
  enabled: boolean;
  sessionId: string;
  sessionPath: string;
  maxSizeMB: number;
  refreshIntervalSeconds: number;
  stopped: boolean;
  createdAt: string;
}

let cachedConfig: WatchdogConfig | null = null;
let lastLoadTime = 0;
const CACHE_DURATION_MS = 5000; // Recheck every 5 seconds

export function loadWatchdogConfig(): WatchdogConfig | null {
  const now = Date.now();

  // Use cached config if still valid
  if (cachedConfig && now - lastLoadTime < CACHE_DURATION_MS) {
    return cachedConfig;
  }

  if (!existsSync(WATCHDOG_CONFIG_FILE)) {
    cachedConfig = null;
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(WATCHDOG_CONFIG_FILE, "utf-8"));
    cachedConfig = raw as WatchdogConfig;
    lastLoadTime = now;
    return cachedConfig;
  } catch (e) {
    console.error(`[watchdog] Failed to load config: ${e}`);
    cachedConfig = null;
    return null;
  }
}

export function isSessionStopped(): boolean {
  const config = loadWatchdogConfig();
  return config?.stopped === true;
}
