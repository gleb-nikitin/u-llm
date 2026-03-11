/**
 * Watchdog: Monitors SDK query execution for timeouts and errors.
 * Detects hung queries and alerts when responses take too long.
 */

import { sdkQuery, type SdkQueryOptions, type SdkQueryResult } from "./sdk-query";

const QUERY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface WatchdogAlert {
  participantId: string;
  chainId: string;
  reason: "timeout" | "error";
  message: string;
  timestamp: number;
}

let alertCallback: ((alert: WatchdogAlert) => Promise<void>) | null = null;

export function setWatchdogAlertCallback(
  callback: (alert: WatchdogAlert) => Promise<void>,
): void {
  alertCallback = callback;
}

async function sendAlert(alert: WatchdogAlert): Promise<void> {
  if (alertCallback) {
    try {
      await alertCallback(alert);
    } catch (err) {
      console.error("[watchdog] alert callback failed:", err);
    }
  }
}

export async function sdkQueryWithWatchdog(
  participantId: string,
  chainId: string,
  prompt: string,
  options: SdkQueryOptions,
): Promise<SdkQueryResult> {
  const startMs = Date.now();
  const timeoutHandle = setTimeout(() => {
    const elapsed = Date.now() - startMs;
    const alert: WatchdogAlert = {
      participantId,
      chainId,
      reason: "timeout",
      message: `SDK query exceeded ${QUERY_TIMEOUT_MS}ms (${elapsed}ms elapsed)`,
      timestamp: Date.now(),
    };
    console.warn(`[watchdog] timeout alert for ${participantId}:`, alert);
    sendAlert(alert).catch(() => {
      // Non-critical
    });
  }, QUERY_TIMEOUT_MS);

  try {
    const result = await sdkQuery(prompt, options);
    clearTimeout(timeoutHandle);
    return result;
  } catch (err) {
    clearTimeout(timeoutHandle);
    const alert: WatchdogAlert = {
      participantId,
      chainId,
      reason: "error",
      message: err instanceof Error ? err.message : "Unknown SDK error",
      timestamp: Date.now(),
    };
    console.error(`[watchdog] error alert for ${participantId}:`, alert);
    await sendAlert(alert).catch(() => {
      // Non-critical
    });
    throw err;
  }
}
