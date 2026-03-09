import { UMSG_BASE_URL } from "./config";

// Legacy single-connection module — kept for reference.
// New code uses WsManager (ws-manager.ts).
const UMSG_PARTICIPANT_ID =
  process.env.UMSG_PARTICIPANT_ID || "u-llm";
const UMSG_WS_URL =
  UMSG_BASE_URL.replace(/^http/, "ws") +
  `/ws/stream?participant=${UMSG_PARTICIPANT_ID}`;

type MessageListener = (data: unknown) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let listener: MessageListener | null = null;
let connectedAt: number | null = null;
let intentionalClose = false;

const MAX_RECONNECT_DELAY = 30_000;

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

export function getUptime(): number {
  return connectedAt ? Date.now() - connectedAt : 0;
}

export function getParticipantId(): string {
  return UMSG_PARTICIPANT_ID;
}

export function onMessage(fn: MessageListener): void {
  listener = fn;
}

function scheduleReconnect(): void {
  if (intentionalClose) return;
  if (reconnectTimer) return;
  console.log(`[umsg-ws] reconnecting in ${reconnectDelay}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

export function connect(): void {
  intentionalClose = false;

  try {
    ws = new WebSocket(UMSG_WS_URL);
  } catch (err) {
    console.error("[umsg-ws] failed to create WebSocket:", err);
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", () => {
    console.log("[umsg-ws] connected to", UMSG_WS_URL);
    connectedAt = Date.now();
    reconnectDelay = 1000;
  });

  ws.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(String(event.data));
      listener?.(data);
    } catch (err) {
      console.error("[umsg-ws] bad message:", err);
    }
  });

  ws.addEventListener("close", () => {
    console.log("[umsg-ws] disconnected");
    connectedAt = null;
    scheduleReconnect();
  });

  ws.addEventListener("error", (err) => {
    console.error("[umsg-ws] error:", err);
  });
}

export function disconnect(): void {
  intentionalClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
  connectedAt = null;
}

export function reconnect(): void {
  disconnect();
  connect();
}
