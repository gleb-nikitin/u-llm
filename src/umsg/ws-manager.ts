import { UMSG_BASE_URL } from "./config";
import type { ParticipantConfig } from "../participants/config";

type MessageListener = (participantId: string, data: unknown) => void;

interface ParticipantConnection {
  participantId: string;
  ws: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectDelay: number;
  connectedAt: number | null;
  intentionalClose: boolean;
}

const MAX_RECONNECT_DELAY = 30_000;

export class WsManager {
  private connections = new Map<string, ParticipantConnection>();
  private listener: MessageListener | null = null;

  onMessage(fn: MessageListener): void {
    this.listener = fn;
  }

  connectAll(participants: ParticipantConfig[]): void {
    for (const p of participants) {
      this.connectOne(p.id);
    }
  }

  disconnectAll(): void {
    for (const conn of this.connections.values()) {
      this.disconnectOne(conn);
    }
    this.connections.clear();
  }

  reconnectAll(): void {
    for (const conn of this.connections.values()) {
      this.disconnectOne(conn);
      this.connectOne(conn.participantId);
    }
  }

  private disconnectOne(conn: ParticipantConnection): void {
    conn.intentionalClose = true;
    if (conn.reconnectTimer) {
      clearTimeout(conn.reconnectTimer);
      conn.reconnectTimer = null;
    }
    conn.ws?.close();
    conn.ws = null;
    conn.connectedAt = null;
  }

  getStatus(): Array<{
    participantId: string;
    connected: boolean;
    uptimeMs: number;
  }> {
    return Array.from(this.connections.values()).map((conn) => ({
      participantId: conn.participantId,
      connected: conn.ws?.readyState === WebSocket.OPEN,
      uptimeMs: conn.connectedAt ? Date.now() - conn.connectedAt : 0,
    }));
  }

  private connectOne(participantId: string): void {
    let conn = this.connections.get(participantId);
    if (!conn) {
      conn = {
        participantId,
        ws: null,
        reconnectTimer: null,
        reconnectDelay: 1000,
        connectedAt: null,
        intentionalClose: false,
      };
      this.connections.set(participantId, conn);
    }

    conn.intentionalClose = false;
    const wsUrl =
      UMSG_BASE_URL.replace(/^http/, "ws") +
      `/ws/stream?participant=${participantId}`;

    try {
      conn.ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error(`[ws:${participantId}] failed to create WebSocket:`, err);
      this.scheduleReconnect(conn);
      return;
    }

    conn.ws.addEventListener("open", () => {
      console.log(`[ws:${participantId}] connected`);
      conn!.connectedAt = Date.now();
      conn!.reconnectDelay = 1000;
    });

    conn.ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(String(event.data));
        this.listener?.(participantId, data);
      } catch (err) {
        console.error(`[ws:${participantId}] bad message:`, err);
      }
    });

    conn.ws.addEventListener("close", () => {
      console.log(`[ws:${participantId}] disconnected`);
      conn!.connectedAt = null;
      this.scheduleReconnect(conn!);
    });

    conn.ws.addEventListener("error", (err) => {
      console.error(`[ws:${participantId}] error:`, err);
    });
  }

  private scheduleReconnect(conn: ParticipantConnection): void {
    if (conn.intentionalClose) return;
    if (conn.reconnectTimer) return;
    console.log(
      `[ws:${conn.participantId}] reconnecting in ${conn.reconnectDelay}ms...`,
    );
    conn.reconnectTimer = setTimeout(() => {
      conn.reconnectTimer = null;
      this.connectOne(conn.participantId);
    }, conn.reconnectDelay);
    conn.reconnectDelay = Math.min(
      conn.reconnectDelay * 2,
      MAX_RECONNECT_DELAY,
    );
  }
}
