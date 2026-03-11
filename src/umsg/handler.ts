import { sdkQuery } from "../sdk-query";
import {
  getParticipantConfig,
  type ParticipantConfig,
} from "../participants/config";
import {
  getSession,
  setCurrentSession,
  clearCurrentSession,
} from "../participants/session-store";
import { writeMessage, markRead, fetchMessageBySeq } from "./client";
import { formatIncoming, parseResponse, FORMAT_INSTRUCTIONS } from "./message-format";

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
  current: string | null,
  saved: string | null,
  clear?: boolean,
): { resume?: string; forkSession?: boolean; persistSession: boolean } {
  if (clear) {
    if (saved) {
      return { resume: saved, forkSession: true, persistSession: true };
    }
    return { persistSession: true };
  }
  if (current) {
    return { resume: current, persistSession: true };
  }
  if (saved) {
    return { resume: saved, forkSession: true, persistSession: true };
  }
  return { persistSession: true };
}

export async function handleNewMessage(
  participantId: string,
  data: unknown,
): Promise<void> {
  const event = data as WsEvent;
  if (event.type !== "new_message" || !event.chain_id) return;

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

  // Only respond if this participant is in notify or response_from
  const shouldRespond =
    msg.notify?.includes(participantId) ||
    msg.response_from === participantId;
  if (!shouldRespond) return;

  const clear = msg.meta?.clear === true;

  // Format incoming message
  const prompt = formatIncoming(msg.summary, msg.content);

  console.log(
    `[umsg:${participantId}] incoming from=${msg.from_id} chain=${chainId} len=${msg.content.length} clear=${clear}`,
  );

  const startMs = Date.now();

  try {
    // Clear current session if requested
    if (clear) {
      await clearCurrentSession(participantId);
    }

    // Unified session logic: all roles use current/saved/fork/fresh
    const { current, saved } = getSession(participantId);
    const { resume, forkSession, persistSession } = resolveSessionOptions(current, saved, clear);
    if (forkSession) {
      console.log(`[umsg:${participantId}] forking from saved checkpoint=${saved}`);
    }

    const result = await sdkQuery(prompt, {
      model: config.model,
      effort: config.effort,
      resume,
      forkSession,
      persistSession,
      cwd: config.projectPath,
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: FORMAT_INSTRUCTIONS + "\n\n" + config.rolePrompt,
      },
    });

    // Always persist session
    if (result.sessionId) {
      await setCurrentSession(participantId, result.sessionId);
    }

    // Parse response into summary + content
    const parsed = parseResponse(result.text);

    // Cost logging
    const durationMs = Date.now() - startMs;
    console.log(
      `[cost] participant=${participantId} session=${result.sessionId} turns=${result.numTurns} cost_usd=${result.costUsd.toFixed(4)} duration_ms=${durationMs}`,
    );

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
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[umsg:${participantId}] error chain=${chainId}:`, errorMsg);

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
