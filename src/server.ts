import { Hono } from "hono";
import queryRoute from "./routes/query";
import sessionsRoute from "./routes/sessions";
import streamRoute from "./routes/stream";
import { createUmsgRoute } from "./routes/umsg";
import { createSessionRoute } from "./routes/session";
import { loadParticipants } from "./participants/config";
import { archiveLegacyFiles } from "./participants/session-store";
import { WsManager } from "./umsg/ws-manager";
import { handleNewMessage, setParticipants } from "./umsg/handler";

const app = new Hono();
const startTime = Date.now();

// Load participant config and set up WS manager
const participants = loadParticipants();
setParticipants(participants);

const wsManager = new WsManager();

// Archive legacy session files
archiveLegacyFiles();

// D8: Health endpoint with per-participant status
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    uptime_ms: Date.now() - startTime,
    participants: wsManager.getStatus().map((s) => ({
      id: s.participantId,
      connected: s.connected,
      uptime_ms: s.uptimeMs,
    })),
  });
});

app.route("/api/query", queryRoute);
app.route("/api/sessions", sessionsRoute);
app.route("/api/stream", streamRoute);
app.route("/api/umsg", createUmsgRoute(wsManager));
app.route("/api/participants", createSessionRoute(participants));

// Start u-msg WebSocket connections for all participants
wsManager.onMessage((participantId, data) => {
  handleNewMessage(participantId, data).catch((err) => {
    console.error(`[umsg:${participantId}] unhandled handler error:`, err);
  });
});
wsManager.connectAll(participants);

const port = Number(process.env.PORT) || 18180;
console.log(
  `u-llm server listening on port ${port} with ${participants.length} participants: ${participants.map((p) => p.id).join(", ")}`,
);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255,  // ~4min per connection; SDK streams keep alive within this
};
