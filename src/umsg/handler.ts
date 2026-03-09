import { sdkQuery } from "../sdk-query";
import { upsertSession } from "../session-store";
import { writeMessage, markRead, fetchLatestMessage } from "./client";
import { getChainSession, setChainSession } from "./session-map";
import { UMSG_PARTICIPANT_ID } from "./config";

interface WsEvent {
  type?: string;
  chain_id?: string;
  seq?: number;
  from_id?: string;
  summary?: string;
}

export async function handleNewMessage(data: unknown): Promise<void> {
  const event = data as WsEvent;
  if (event.type !== "new_message" || !event.chain_id) return;

  // Ignore own messages to prevent loops
  if (event.from_id === UMSG_PARTICIPANT_ID) return;

  const chainId = event.chain_id;

  // Fetch full message from u-msg API
  const msg = await fetchLatestMessage(chainId);
  if (!msg) return;

  // Double-check: skip if fetched message is from us
  if (msg.from_id === UMSG_PARTICIPANT_ID) return;

  // Only respond if u-llm is in notify or response_from
  const shouldRespond =
    msg.notify?.includes(UMSG_PARTICIPANT_ID) ||
    msg.response_from === UMSG_PARTICIPANT_ID;
  if (!shouldRespond) return;

  const prompt = msg.content;

  console.log(
    `[umsg-handler] incoming from=${msg.from_id} chain=${chainId} len=${prompt.length}`,
  );

  try {
    // Look up existing session for this chain
    const existingSessionId = getChainSession(chainId);

    const result = await sdkQuery(prompt, {
      resume: existingSessionId,
    });

    // Persist session mapping
    if (result.sessionId) {
      await setChainSession(chainId, result.sessionId);
      await upsertSession(result.sessionId, prompt);
    }

    // Write response back to chain
    await writeMessage(chainId, {
      content: result.text,
      notify: [msg.from_id],
      type: "chat",
    });

    console.log(
      `[umsg-handler] replied chain=${chainId} session=${result.sessionId} turns=${result.numTurns}`,
    );
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unknown error";
    console.error(`[umsg-handler] error chain=${chainId}:`, errorMsg);

    // Write error message to chain
    try {
      await writeMessage(chainId, {
        content: `LLM error: ${errorMsg}`,
        notify: [msg.from_id],
        type: "error",
      });
    } catch (writeErr) {
      console.error("[umsg-handler] failed to write error to chain:", writeErr);
    }
  }

  // Mark incoming message as read
  try {
    await markRead(chainId);
  } catch {
    // non-critical
  }
}
