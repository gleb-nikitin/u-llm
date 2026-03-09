import { Hono } from "hono";
import queryRoute from "./routes/query";
import sessionsRoute from "./routes/sessions";

const app = new Hono();
const startTime = Date.now();

app.get("/health", (c) => {
  return c.json({ status: "ok", uptime_ms: Date.now() - startTime });
});

app.route("/api/query", queryRoute);
app.route("/api/sessions", sessionsRoute);

const port = Number(process.env.PORT) || 18180;
console.log(`u-llm server listening on port ${port}`);

export default { port, fetch: app.fetch };
