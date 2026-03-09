import { Hono } from "hono";
import {
  isConnected,
  getUptime,
  getParticipantId,
  reconnect,
} from "../umsg/ws";

const umsgRoute = new Hono();

umsgRoute.get("/status", (c) => {
  return c.json({
    connected: isConnected(),
    participant_id: getParticipantId(),
    uptime_ms: getUptime(),
  });
});

umsgRoute.post("/reconnect", (c) => {
  reconnect();
  return c.json({ status: "reconnecting" });
});

export default umsgRoute;
