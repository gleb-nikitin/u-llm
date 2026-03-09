import { Hono } from "hono";
import type { WsManager } from "../umsg/ws-manager";

export function createUmsgRoute(wsManager: WsManager): Hono {
  const route = new Hono();

  route.get("/status", (c) => {
    const status = wsManager.getStatus();
    return c.json({
      participants: status.map((s) => ({
        id: s.participantId,
        connected: s.connected,
        uptime_ms: s.uptimeMs,
      })),
    });
  });

  route.post("/reconnect", (c) => {
    wsManager.reconnectAll();
    return c.json({ status: "reconnecting" });
  });

  return route;
}
