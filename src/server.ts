import { Hono } from "hono";
import queryRoute from "./routes/query";
import sessionsRoute from "./routes/sessions";
import umsgRoute from "./routes/umsg";
import { connect, onMessage } from "./umsg/ws";
import { handleNewMessage } from "./umsg/handler";

const app = new Hono();
const startTime = Date.now();

app.get("/health", (c) => {
  return c.json({ status: "ok", uptime_ms: Date.now() - startTime });
});

app.route("/api/query", queryRoute);
app.route("/api/sessions", sessionsRoute);
app.route("/api/umsg", umsgRoute);

// Start u-msg WebSocket connection
onMessage((data) => {
  handleNewMessage(data).catch((err) => {
    console.error("[umsg] unhandled handler error:", err);
  });
});
connect();

const port = Number(process.env.PORT) || 18180;
console.log(`u-llm server listening on port ${port}`);

export default { port, fetch: app.fetch };
