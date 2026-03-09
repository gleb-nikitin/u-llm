import { sdkQuery } from "../sdk-query";
import {
  getParticipantConfig,
  type ParticipantConfig,
} from "../participants/config";
import {
  getSession,
  setSession,
} from "../participants/session-store";
import { writeMessage, markRead, fetchLatestMessage } from "./client";

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

  // Fetch full message from u-msg API
  const msg = await fetchLatestMessage(chainId);
  if (!msg) return;

  // Double-check: skip if fetched message is from us
  if (msg.from_id === participantId) return;

  // Only respond if this participant is in notify or response_from
  const shouldRespond =
    msg.notify?.includes(participantId) ||
    msg.response_from === participantId;
  if (!shouldRespond) return;

  // All participants get full message content
  // Persistent roles have session context; ephemeral roles start fresh
  const prompt: string = msg.content;

  console.log(
    `[umsg:${participantId}] incoming from=${msg.from_id} chain=${chainId} len=${prompt.length}`,
  );

  const startMs = Date.now();

  try {
    // Session logic by policy
    let resume: string | undefined;
    let persistSession: boolean;

    if (config.sessionPolicy === "persistent") {
      resume = getSession(participantId);
      persistSession = true;
    } else {
      resume = undefined;
      persistSession = false;
    }

    const result = await sdkQuery(prompt, {
      model: config.model,
      resume,
      persistSession,
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: config.rolePrompt,
      },
    });

    // Persist session for persistent roles
    if (config.sessionPolicy === "persistent" && result.sessionId) {
      await setSession(participantId, result.sessionId);
    }

    // Cost logging (D9)
    const durationMs = Date.now() - startMs;
    console.log(
      `[cost] participant=${participantId} session=${result.sessionId} turns=${result.numTurns} cost_usd=${result.costUsd.toFixed(4)} duration_ms=${durationMs}`,
    );

    // Write response back to chain
    await writeMessage(
      chainId,
      {
        content: result.text,
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
