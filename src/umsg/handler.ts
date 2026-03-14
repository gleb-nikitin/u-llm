import { sdkQuery } from "../sdk-query";
import { sseHub } from "../sse/hub";
import {
  getParticipantConfig,
  type ParticipantConfig,
} from "../participants/config";
import {
  getSession,
  setActive,
} from "../participants/session-store";
import { writeMessage, markRead, fetchMessageBySeq } from "./client";
import { formatIncoming, parseResponse, FORMAT_INSTRUCTIONS } from "./message-format";
import { isSessionStopped } from "../watchdog";

interface WsEvent {
  type?: string;
  chain_id?: string;
  seq?: number;
  from_id?: string;
  summary?: string;
}

let participantsList: ParticipantConfig[] = [];

export function setParticipants(participants: ParticipantConfig[]): void {
  participantsList = participants;
}

export function resolveSessionOptions(
  active: string | null,
  savedIds: string[],
  clear?: boolean,
): { resume?: string; forkSession?: boolean; persistSession: boolean } {
  const isSaved = active !== null && savedIds.includes(active);

  if (clear) {
    if (isSaved) return { resume: active, forkSession: true, persistSession: true };
    return { persistSession: true };
  }

  if (active) {
    if (isSaved) return { resume: active, forkSession: true, persistSession: true };
    return { resume: active, persistSession: true };
  }

  return { persistSession: true };
}

export async function handleNewMessage(
  participantId: string,
  data: unknown,
): Promise<void> {
  const event = data as WsEvent;
  if (event.type !== "new_message" || !event.chain_id) return;

  // Watchdog check: hard-stop if session is size-limited
  if (isSessionStopped()) {
    console.log(`[umsg:${participantId}] ⛔ Session is stopped by watchdog, rejecting message`);
    return;
  }

  // Self-loop guard: check per participant
  if (event.from_id === participantId) return;

  const chainId = event.chain_id;
  const config = getParticipantConfig(participantsList, participantId);
  if (!config) {
    console.error(`[umsg:${participantId}] no config found, skipping`);
    return;
  }

  // Fetch the specific message by seq from u-msg API
  if (!event.seq) return;
  const msg = await fetchMessageBySeq(chainId, event.seq);
  if (!msg) return;

  // Double-check: skip if fetched message is from us
  if (msg.from_id === participantId) return;

  // Determine role: responder (response_from) vs observer (notify only)
  const isResponder = msg.response_from === participantId;
  const isNotified = msg.notify?.includes(participantId);
  if (!isResponder && !isNotified) return;

  // Notify-only: log and exit — no LLM call, no session mutation
  if (!isResponder) {
    const summary = msg.summary || msg.content.slice(0, 100);
    const logLine = `${new Date().toISOString()} | ${participantId} | chain=${chainId} | from=${msg.from_id} | summary=${summary}\n`;
    try {
      const { appendFileSync } = await import("fs");
      const { join } = await import("path");
      appendFileSync(join(import.meta.dir, "..", "..", "data", "notifications.log"), logLine);
    } catch { /* non-critical */ }
    console.log(`[umsg:${participantId}] notification logged (no LLM call)`);
    await markRead(chainId, participantId);
    return;
  }

  const clear = msg.meta?.clear === true;

  // Format incoming message
  const prompt = formatIncoming(msg.summary, msg.content);

  console.log(
    `[umsg:${participantId}] incoming from=${msg.from_id} chain=${chainId} len=${msg.content.length} clear=${clear}`,
  );

  const startMs = Date.now();
  const streamingEnabled = sseHub.isStreamingEnabled();

  try {
    // Emit start event to SSE hub (only if streaming enabled)
    if (streamingEnabled) {
      sseHub.emit({
        type: "start",
        participant_id: participantId,
        chain_id: chainId,
        timestamp: new Date().toISOString(),
      });
    }

    // Read state BEFORE any mutation
    const { active, saved } = getSession(participantId);
    const savedIds = saved.map((s) => s.id);
    const { resume, forkSession, persistSession } = resolveSessionOptions(active, savedIds, clear);

    const sdkQueryOptions: Parameters<typeof sdkQuery>[1] = {
      model: config.model,
      effort: config.effort,
      resume,
      forkSession,
      persistSession,
      cwd: config.projectPath,
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: FORMAT_INSTRUCTIONS,
      },
    };

    // Only enable streaming and onEvent if streaming is globally enabled
    if (streamingEnabled) {
      sdkQueryOptions.stream = true;
      sdkQueryOptions.onEvent = (event) => {
        // Forward SDK events to SSE hub with participant_id
        sseHub.emit({
          ...event,
          participant_id: participantId,
        });
      };
    }

    const result = await sdkQuery(prompt, sdkQueryOptions);

    // Always persist session — just update active pointer
    if (result.sessionId) {
      await setActive(participantId, result.sessionId);
    }

    // Cost logging
    const durationMs = Date.now() - startMs;
    console.log(
      `[cost] participant=${participantId} model=${result.actualModel} session=${result.sessionId} turns=${result.numTurns} cost_usd=${result.costUsd.toFixed(4)} duration_ms=${durationMs}`,
    );

    // Parse response into summary + content
    if (!result.text) {
      const logLine = `${new Date().toISOString()} | ${participantId} | chain=${chainId} | empty_text | turns=${result.numTurns} | cost=${result.costUsd.toFixed(4)} | session=${result.sessionId}\n`;
      console.warn(`[umsg:${participantId}] SDK returned empty text, skipping write`);
      try {
        const { appendFileSync } = await import("fs");
        const { join } = await import("path");
        appendFileSync(join(import.meta.dir, "..", "..", "data", "sdk-errors.log"), logLine);
      } catch { /* non-critical */ }
      return;
    }
    const parsed = parseResponse(result.text);

    // Write response back to chain with explicit summary
    await writeMessage(
      chainId,
      {
        content: parsed.content,
        summary: parsed.summary,
        notify: [msg.from_id],
        type: "chat",
      },
      participantId,
    );

    console.log(
      `[umsg:${participantId}] replied chain=${chainId} session=${result.sessionId} turns=${result.numTurns}`,
    );

    // Emit done event to SSE hub (only if streaming was enabled)
    if (streamingEnabled) {
      sseHub.emit({
        type: "done",
        participant_id: participantId,
        model: result.actualModel || config.model,
        session_id: result.sessionId,
        turns: result.numTurns,
        cost_usd: result.costUsd,
        duration_ms: Date.now() - startMs,
      });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[umsg:${participantId}] error chain=${chainId}:`, errorMsg);

    // Emit error event to SSE hub (only if streaming was enabled)
    if (streamingEnabled) {
      sseHub.emit({
        type: "error",
        participant_id: participantId,
        error: errorMsg,
      });
    }

    try {
      await writeMessage(
        chainId,
        {
          content: `LLM error: ${errorMsg}`,
          notify: [msg.from_id],
          type: "error",
        },
        participantId,
      );
    } catch (writeErr) {
      console.error(
        `[umsg:${participantId}] failed to write error to chain:`,
        writeErr,
      );
    }
  }

  // Mark incoming message as read
  try {
    await markRead(chainId, participantId);
  } catch {
    // non-critical
  }
}
