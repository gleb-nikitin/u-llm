import { Hono } from "hono";
import { loadSessions } from "../session-store";

const app = new Hono();

app.get("/", (c) => {
  const sessions = loadSessions();
  sessions.sort(
    (a, b) =>
      new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime(),
  );
  return c.json(
    sessions.map((s) => ({
      session_id: s.session_id,
      last_used_at: s.last_used_at,
      prompt_preview: s.prompt_preview,
    })),
  );
});

export default app;
