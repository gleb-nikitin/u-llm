export interface SSEEvent {
  type:
    | "start"
    | "token"
    | "tool_use"
    | "tool_result"
    | "thinking"
    | "done"
    | "error";
  participant_id?: string;
  chain_id?: string;
  timestamp?: string;
  text?: string;
  tool?: string;
  input?: unknown;
  result?: string;
  summary?: string;
  session_id?: string;
  turns?: number;
  cost_usd?: number;
  duration_ms?: number;
  error?: string;
}

export type DetailMode = "minimal" | "standard" | "verbose";

interface SSESubscriber {
  enqueue: (data: Uint8Array) => void;
  participantFilter?: string;
  detailMode: DetailMode;
}

export interface StreamStatus {
  enabled: boolean;
  detail: DetailMode;
  clients: number;
  logging: boolean;
}

export class SSEHub {
  private subscribers: Map<string, SSESubscriber> = new Map();
  private subscriberCounter = 0;
  private encoder = new TextEncoder();
  private debugLoggingEnabled = false;
  private debugLogFile: string | null = null;
  private streamingEnabled = false;
  private globalDetailMode: DetailMode = "standard";

  /**
   * Register a new SSE subscriber (ReadableStream controller).
   * @param enqueue - Function to enqueue data into the stream
   * @param participantFilter - Optional participant ID to filter events
   * @param detailMode - Detail level: minimal (start/done/error), standard (+ token/tool_use), verbose (+ tool_result/thinking)
   * @returns subscriber ID
   */
  subscribe(
    enqueue: (data: Uint8Array) => void,
    participantFilter?: string,
    detailMode: DetailMode = "standard",
  ): string {
    const subscriberId = `sub_${this.subscriberCounter++}`;
    this.subscribers.set(subscriberId, {
      enqueue,
      participantFilter,
      detailMode,
    });
    return subscriberId;
  }

  /**
   * Unsubscribe an SSE subscriber.
   */
  unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId);
  }

  /**
   * Filter event based on detail mode.
   * Returns false if event should be skipped for this detail level.
   */
  private shouldEmitEvent(event: SSEEvent, detailMode: DetailMode): boolean {
    switch (detailMode) {
      case "minimal":
        // Only start, done, error
        return ["start", "done", "error"].includes(event.type);
      case "standard":
        // start, done, error, token, tool_use
        return ["start", "done", "error", "token", "tool_use"].includes(
          event.type,
        );
      case "verbose":
        // All events
        return true;
    }
  }

  /**
   * Write debug log entry.
   */
  private writeDebugLog(event: SSEEvent): void {
    if (!this.debugLoggingEnabled) return;

    try {
      const Bun = require("bun");
      const logLine =
        new Date().toISOString() + " " + JSON.stringify(event) + "\n";
      Bun.file(this.debugLogFile!).append(logLine);
    } catch {
      // Silent fail — debug logging is best-effort
    }
  }

  /**
   * Enable or disable debug logging to file.
   */
  setDebugLogging(enable: boolean, logFile: string = "data/sse-debug.log"): void {
    this.debugLoggingEnabled = enable;
    this.debugLogFile = logFile;

    if (enable) {
      try {
        const Bun = require("bun");
        // Truncate file on enable
        Bun.write(logFile, "");
      } catch {
        // Silent fail
      }
    }
  }

  /**
   * Emit an event to all matching subscribers.
   */
  emit(event: SSEEvent): void {
    // Write to debug log if enabled
    if (this.debugLoggingEnabled) {
      this.writeDebugLog(event);
    }

    const eventData = JSON.stringify(event);
    const sseMessage = this.encoder.encode(
      `event: ${event.type}\ndata: ${eventData}\n\n`,
    );

    const deadSubscribers: string[] = [];

    for (const [subscriberId, subscriber] of this.subscribers) {
      // Skip if subscriber doesn't match filter
      if (
        subscriber.participantFilter &&
        event.participant_id !== subscriber.participantFilter
      ) {
        continue;
      }

      // Skip if event doesn't match detail mode
      if (!this.shouldEmitEvent(event, subscriber.detailMode)) {
        continue;
      }

      try {
        subscriber.enqueue(sseMessage);
      } catch {
        // Mark dead subscribers for cleanup
        deadSubscribers.push(subscriberId);
      }
    }

    // Clean up dead subscribers
    for (const subscriberId of deadSubscribers) {
      this.subscribers.delete(subscriberId);
    }
  }

  /**
   * Get current subscriber count.
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Enable or disable streaming globally.
   */
  setStreamingEnabled(enabled: boolean): void {
    this.streamingEnabled = enabled;
  }

  /**
   * Check if streaming is enabled.
   */
  isStreamingEnabled(): boolean {
    return this.streamingEnabled;
  }

  /**
   * Set global detail mode.
   */
  setDetailMode(mode: DetailMode): void {
    this.globalDetailMode = mode;
  }

  /**
   * Get current streaming status.
   */
  getStatus(): StreamStatus {
    return {
      enabled: this.streamingEnabled,
      detail: this.globalDetailMode,
      clients: this.subscribers.size,
      logging: this.debugLoggingEnabled,
    };
  }
}

// Global singleton
export const sseHub = new SSEHub();
