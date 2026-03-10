import { Hono } from "hono";
import { type ParticipantConfig } from "../participants/config";
import {
  getSession,
  setSavedSession,
  clearSavedSession,
} from "../participants/session-store";

export function createSessionRoute(participants: ParticipantConfig[]) {
  const app = new Hono();

  function findParticipant(id: string): ParticipantConfig | undefined {
    return participants.find((p) => p.id === id);
  }

  // GET /api/participants
  app.get("/", (c) => {
    return c.json(
      participants.map((p) => {
        const session = getSession(p.id);
        return {
          id: p.id,
          role: p.role,
          project: p.project,
          session,
        };
      }),
    );
  });

  // GET /api/participants/:id/session
  app.get("/:id/session", (c) => {
    const id = c.req.param("id");
    const participant = findParticipant(id);
    if (!participant) {
      return c.json({ error: "participant not found" }, 404);
    }

    const { current, saved } = getSession(id);
    return c.json({
      participantId: id,
      current,
      saved,
    });
  });

  // POST /api/participants/:id/session
  app.post("/:id/session", async (c) => {
    const id = c.req.param("id");
    const participant = findParticipant(id);
    if (!participant) {
      return c.json({ error: "participant not found" }, 404);
    }

    const body = await c.req.json<{ action: string }>();
    const { action } = body;
    const { current, saved } = getSession(id);

    if (action === "save") {
      if (!current) {
        return c.json({ ok: false, error: "no current session" }, 400);
      }
      await setSavedSession(id, current);
      return c.json({ ok: true, saved: current });
    }

    if (action === "delete-saved") {
      await clearSavedSession(id);
      return c.json({ ok: true });
    }

    return c.json({ ok: false, error: `unknown action: ${action}` }, 400);
  });

  return app;
}
