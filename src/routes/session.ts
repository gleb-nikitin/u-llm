import { Hono } from "hono";
import { type ParticipantConfig } from "../participants/config";
import {
  getSession,
  setActive,
  saveSession,
  deleteSaved,
  labelSaved,
  clearActive,
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
        const { active, saved } = getSession(p.id);
        return {
          id: p.id,
          role: p.role,
          project: p.project,
          model: p.model,
          effort: p.effort,
          session: { active, saved },
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
    const { active, saved } = getSession(id);
    return c.json({ participantId: id, active, saved });
  });

  // POST /api/participants/:id/sessions/save
  app.post("/:id/sessions/save", async (c) => {
    const id = c.req.param("id");
    const participant = findParticipant(id);
    if (!participant) {
      return c.json({ error: "participant not found" }, 404);
    }
    const result = await saveSession(id);
    if (!result.ok) return c.json(result, 400);
    return c.json(result);
  });

  // PUT /api/participants/:id/sessions/active
  app.put("/:id/sessions/active", async (c) => {
    const id = c.req.param("id");
    const participant = findParticipant(id);
    if (!participant) {
      return c.json({ error: "participant not found" }, 404);
    }
    const body = await c.req.json<{ sessionId: string | null }>();
    if (body.sessionId === null) {
      await clearActive(id);
      return c.json({ ok: true });
    }
    // Validate sessionId against saved[]
    const { saved } = getSession(id);
    const exists = saved.some((s) => s.id === body.sessionId);
    if (!exists) return c.json({ ok: false, error: "session not found in saved" }, 400);
    await setActive(id, body.sessionId);
    return c.json({ ok: true });
  });

  // PATCH /api/participants/:id/sessions/:sid
  app.patch("/:id/sessions/:sid", async (c) => {
    const id = c.req.param("id");
    const sid = c.req.param("sid");
    const participant = findParticipant(id);
    if (!participant) {
      return c.json({ error: "participant not found" }, 404);
    }
    const body = await c.req.json<{ label: string }>();
    const result = await labelSaved(id, sid, body.label);
    if (!result.ok) return c.json(result, 400);
    return c.json(result);
  });

  // DELETE /api/participants/:id/sessions/:sid
  app.delete("/:id/sessions/:sid", async (c) => {
    const id = c.req.param("id");
    const sid = c.req.param("sid");
    const participant = findParticipant(id);
    if (!participant) {
      return c.json({ error: "participant not found" }, 404);
    }
    await deleteSaved(id, sid);
    return c.json({ ok: true });
  });

  return app;
}
