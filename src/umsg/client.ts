import { UMSG_BASE_URL, UMSG_PARTICIPANT_ID } from "./config";

interface WriteRequest {
  content: string;
  notify: string[];
  type: "chat" | "event" | "status" | "error";
  response_from?: string | null;
  meta?: unknown;
}

interface WriteResponse {
  msg_id: string;
  chain_id: string;
  seq: number;
}

export interface StoredMessage {
  ts: string;
  msg_id: string;
  chain_id: string;
  seq: number;
  from_id: string;
  notify: string[];
  response_from: string | null;
  type: string;
  content: string;
  meta: unknown | null;
}

export async function writeMessage(
  chainId: string,
  body: WriteRequest,
): Promise<WriteResponse> {
  const res = await fetch(
    `${UMSG_BASE_URL}/api/chains/${chainId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Participant-Id": UMSG_PARTICIPANT_ID,
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`u-msg write failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as WriteResponse;
}

export async function fetchLatestMessage(
  chainId: string,
): Promise<StoredMessage | undefined> {
  const res = await fetch(
    `${UMSG_BASE_URL}/api/chains/${chainId}/messages?limit=1`,
  );
  if (!res.ok) {
    throw new Error(`u-msg fetch failed: ${res.status} ${await res.text()}`);
  }
  const messages = (await res.json()) as StoredMessage[];
  return messages[0];
}

export async function markRead(chainId: string): Promise<void> {
  await fetch(`${UMSG_BASE_URL}/api/chains/${chainId}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participant: UMSG_PARTICIPANT_ID }),
  });
}
