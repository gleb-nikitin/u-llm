import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from "fs";

const STORE_FILE = join(import.meta.dir, "..", "..", "..", "data", "participant-sessions.json");
const BACKUP_FILE = STORE_FILE + ".test-backup";

function writeStore(obj: Record<string, unknown>) {
  const dir = join(import.meta.dir, "..", "..", "..", "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(obj, null, 2) + "\n");
}

function clearStore() {
  if (existsSync(STORE_FILE)) unlinkSync(STORE_FILE);
}

async function backupStore() {
  if (existsSync(STORE_FILE)) {
    writeFileSync(BACKUP_FILE, await Bun.file(STORE_FILE).text());
  }
}

async function restoreStore() {
  if (existsSync(BACKUP_FILE)) {
    writeFileSync(STORE_FILE, await Bun.file(BACKUP_FILE).text());
    unlinkSync(BACKUP_FILE);
  } else if (existsSync(STORE_FILE)) {
    unlinkSync(STORE_FILE);
  }
}

import {
  getSession,
  setActive,
  saveSession,
  deleteSaved,
  labelSaved,
  clearActive,
} from "../session-store";

// --- Store tests ---

describe("session-store", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("get empty state returns { active: null, saved: [] }", () => {
    const result = getSession("p1");
    expect(result).toEqual({ active: null, saved: [] });
  });

  test("setActive only sets pointer, does not create saved entries", async () => {
    await setActive("p1", "sess-abc");
    const result = getSession("p1");
    expect(result.active).toBe("sess-abc");
    expect(result.saved).toHaveLength(0);
  });

  test("setActive overwrites previous active", async () => {
    await setActive("p1", "sess-a");
    await setActive("p1", "sess-b");
    const result = getSession("p1");
    expect(result.active).toBe("sess-b");
    expect(result.saved).toHaveLength(0);
  });

  test("saveSession adds active to saved[], error if no active, no-op if already saved", async () => {
    // Error if no active
    const errResult = await saveSession("p1");
    expect(errResult.ok).toBe(false);
    expect(errResult.error).toBeDefined();

    // Save active
    await setActive("p1", "sess-a");
    const saveResult = await saveSession("p1");
    expect(saveResult.ok).toBe(true);
    expect(saveResult.saved?.id).toBe("sess-a");
    expect(getSession("p1").saved).toHaveLength(1);
    expect(getSession("p1").active).toBe("sess-a"); // active not cleared

    // No-op if already saved
    const dupResult = await saveSession("p1");
    expect(dupResult.ok).toBe(true);
    expect(getSession("p1").saved).toHaveLength(1);
  });

  test("deleteSaved removes from saved[], clears active if was active", async () => {
    await setActive("p1", "sess-a");
    await saveSession("p1");
    await deleteSaved("p1", "sess-a");
    const result = getSession("p1");
    expect(result.saved).toHaveLength(0);
    expect(result.active).toBeNull(); // was active, now cleared
  });

  test("deleteSaved does not clear active if different session removed", async () => {
    await setActive("p1", "sess-a");
    await saveSession("p1");
    await setActive("p1", "sess-b");
    await saveSession("p1");
    await deleteSaved("p1", "sess-a");
    const result = getSession("p1");
    expect(result.saved).toHaveLength(1);
    expect(result.saved[0].id).toBe("sess-b");
    expect(result.active).toBe("sess-b");
  });

  test("labelSaved updates label in saved[]", async () => {
    await setActive("p1", "sess-a");
    await saveSession("p1");
    const res = await labelSaved("p1", "sess-a", "My checkpoint");
    expect(res.ok).toBe(true);
    expect(getSession("p1").saved[0].label).toBe("My checkpoint");
  });

  test("labelSaved rejects unknown session", async () => {
    const res = await labelSaved("p1", "no-such-id", "label");
    expect(res.ok).toBe(false);
  });

  test("clearActive sets active to null", async () => {
    await setActive("p1", "sess-a");
    await clearActive("p1");
    expect(getSession("p1").active).toBeNull();
  });

  test("multiple participants independent", async () => {
    await setActive("p1", "sess-p1");
    await setActive("p2", "sess-p2");
    expect(getSession("p1").active).toBe("sess-p1");
    expect(getSession("p2").active).toBe("sess-p2");
    await clearActive("p1");
    expect(getSession("p1").active).toBeNull();
    expect(getSession("p2").active).toBe("sess-p2");
  });
});

// --- Migration tests ---

describe("migration", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("V1 { sessionId } → active set, saved empty", () => {
    writeStore({
      p1: {
        participantId: "p1",
        sessionId: "legacy-v1",
        lastUsedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const result = getSession("p1");
    expect(result.active).toBe("legacy-v1");
    expect(result.saved).toHaveLength(0);
  });

  test("V2 { currentSessionId, savedSessionId } → active + saved checkpoint", () => {
    writeStore({
      p1: {
        participantId: "p1",
        currentSessionId: "current-id",
        savedSessionId: "saved-id",
        lastUsedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const result = getSession("p1");
    expect(result.active).toBe("current-id");
    expect(result.saved).toHaveLength(1);
    expect(result.saved[0].id).toBe("saved-id");
  });

  test("V2 with null savedSessionId → active set, saved empty", () => {
    writeStore({
      p1: {
        participantId: "p1",
        currentSessionId: "current-id",
        savedSessionId: null,
        lastUsedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const result = getSession("p1");
    expect(result.active).toBe("current-id");
    expect(result.saved).toHaveLength(0);
  });

  test("V2 with null currentSessionId → active is null", () => {
    writeStore({
      p1: {
        participantId: "p1",
        currentSessionId: null,
        savedSessionId: "saved-id",
        lastUsedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const result = getSession("p1");
    expect(result.active).toBeNull();
    expect(result.saved).toHaveLength(1);
    expect(result.saved[0].id).toBe("saved-id");
  });

  test("V3 { activeSessionId, sessions } → active + all sessions become saved", () => {
    writeStore({
      p1: {
        participantId: "p1",
        activeSessionId: "sess-b",
        sessions: [
          { id: "sess-a", label: "first", createdAt: "2026-01-01T00:00:00.000Z", lastUsedAt: "2026-01-02T00:00:00.000Z" },
          { id: "sess-b", label: null, createdAt: "2026-01-02T00:00:00.000Z", lastUsedAt: "2026-01-03T00:00:00.000Z" },
        ],
        lastUsedAt: "2026-01-03T00:00:00.000Z",
      },
    });
    const result = getSession("p1");
    expect(result.active).toBe("sess-b");
    expect(result.saved).toHaveLength(2);
    expect(result.saved[0]).toEqual({ id: "sess-a", label: "first", savedAt: "2026-01-01T00:00:00.000Z" });
    expect(result.saved[1]).toEqual({ id: "sess-b", label: null, savedAt: "2026-01-02T00:00:00.000Z" });
  });

  test("V4 { active, saved } → already current format", () => {
    writeStore({
      p1: {
        participantId: "p1",
        active: "sess-x",
        saved: [{ id: "sess-x", label: "checkpoint", savedAt: "2026-01-01T00:00:00.000Z" }],
        lastUsedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const result = getSession("p1");
    expect(result.active).toBe("sess-x");
    expect(result.saved).toHaveLength(1);
    expect(result.saved[0].label).toBe("checkpoint");
  });
});

// --- resolveSessionOptions tests ---

import { resolveSessionOptions } from "../../umsg/handler";

describe("resolveSessionOptions", () => {
  test("no active, no clear → fresh session", () => {
    const opts = resolveSessionOptions(null, []);
    expect(opts.resume).toBeUndefined();
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);
  });

  test("active set, not saved → resume", () => {
    const opts = resolveSessionOptions("sess-123", []);
    expect(opts.resume).toBe("sess-123");
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);
  });

  test("active set, in saved → fork (forkSession: true)", () => {
    const opts = resolveSessionOptions("sess-123", ["sess-123"]);
    expect(opts.resume).toBe("sess-123");
    expect(opts.forkSession).toBe(true);
    expect(opts.persistSession).toBe(true);
  });

  test("clear + active in saved → fork from checkpoint", () => {
    const opts = resolveSessionOptions("sess-123", ["sess-123"], true);
    expect(opts.resume).toBe("sess-123");
    expect(opts.forkSession).toBe(true);
    expect(opts.persistSession).toBe(true);
  });

  test("clear + active not saved → fresh", () => {
    const opts = resolveSessionOptions("sess-123", [], true);
    expect(opts.resume).toBeUndefined();
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);
  });

  test("clear + no active → fresh", () => {
    const opts = resolveSessionOptions(null, [], true);
    expect(opts.resume).toBeUndefined();
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);
  });
});

// --- Handler session flow integration tests ---

describe("handler session flow (store integration)", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("fresh participant → fresh session → setActive", async () => {
    const { active, saved } = getSession("p1");
    expect(active).toBeNull();

    const opts = resolveSessionOptions(active, saved.map((s) => s.id));
    expect(opts.resume).toBeUndefined();
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);

    // After SDK call, persist result session
    await setActive("p1", "sdk-result-1");
    expect(getSession("p1").active).toBe("sdk-result-1");
    expect(getSession("p1").saved).toHaveLength(0); // saved not touched
  });

  test("resume active → same session → setActive", async () => {
    await setActive("p1", "sess-existing");

    const { active, saved } = getSession("p1");
    const opts = resolveSessionOptions(active, saved.map((s) => s.id));
    expect(opts.resume).toBe("sess-existing");
    expect(opts.forkSession).toBeUndefined();

    // SDK returns same sessionId
    await setActive("p1", "sess-existing");
    expect(getSession("p1").saved).toHaveLength(0);
  });

  test("active is saved → fork → new session becomes active, saved untouched", async () => {
    await setActive("p1", "sess-a");
    await saveSession("p1");
    expect(getSession("p1").saved).toHaveLength(1);

    const { active, saved } = getSession("p1");
    const opts = resolveSessionOptions(active, saved.map((s) => s.id));
    expect(opts.resume).toBe("sess-a");
    expect(opts.forkSession).toBe(true);

    // SDK forks: returns new sessionId
    await setActive("p1", "sess-a-fork");
    const result = getSession("p1");
    expect(result.active).toBe("sess-a-fork");
    expect(result.saved).toHaveLength(1); // saved untouched
    expect(result.saved[0].id).toBe("sess-a");
  });

  test("clear + saved selected → fork from saved → new active", async () => {
    await setActive("p1", "sess-a");
    await saveSession("p1");
    // User selects saved checkpoint as active (via PUT /sessions/active)
    // active is still sess-a which is in saved

    const { active, saved } = getSession("p1");
    const opts = resolveSessionOptions(active, saved.map((s) => s.id), true);
    expect(opts.resume).toBe("sess-a");
    expect(opts.forkSession).toBe(true);

    // SDK forks from checkpoint
    await setActive("p1", "sess-a-clear-fork");
    const result = getSession("p1");
    expect(result.active).toBe("sess-a-clear-fork");
    expect(result.saved).toHaveLength(1); // checkpoint preserved
  });

  test("clear + no saved → fresh → new active", async () => {
    await setActive("p1", "sess-old");

    const { active, saved } = getSession("p1");
    const opts = resolveSessionOptions(active, saved.map((s) => s.id), true);
    expect(opts.resume).toBeUndefined();

    // SDK returns new session
    await setActive("p1", "sess-fresh");
    const result = getSession("p1");
    expect(result.active).toBe("sess-fresh");
    expect(result.saved).toHaveLength(0);
  });
});

// --- API route tests ---

import { createSessionRoute } from "../../routes/session";
import type { ParticipantConfig } from "../config";

const FIXTURE_PARTICIPANTS: ParticipantConfig[] = [
  { id: "u-msg_cto", project: "u-msg", role: "cto", model: "claude-haiku-4-5-20251001", effort: "medium", rolePrompt: "You are CTO.", projectPath: "/project" },
  { id: "u-msg_exec", project: "u-msg", role: "exec", model: "claude-haiku-4-5-20251001", effort: "medium", rolePrompt: "You are Executor.", projectPath: "/project" },
];

describe("GET /api/participants", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("returns all participants with session { active, saved }", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      id: "u-msg_cto",
      role: "cto",
      project: "u-msg",
      model: "claude-haiku-4-5-20251001",
      effort: "medium",
      session: { active: null, saved: [] },
    });
  });
});

describe("GET /api/participants/:id/session", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("returns { participantId, active, saved }", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/u-msg_cto/session"));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.participantId).toBe("u-msg_cto");
    expect(body.active).toBeNull();
    expect(Array.isArray(body.saved)).toBe(true);
  });

  test("returns 404 for unknown participant", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/unknown/session"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/participants/:id/sessions/save", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("saves active to saved[], error if no active", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);

    // Error: no active
    const res1 = await route.fetch(new Request("http://localhost/u-msg_cto/sessions/save", {
      method: "POST",
    }));
    expect(res1.status).toBe(400);

    // Set active and save
    await setActive("u-msg_cto", "sess-a");
    const res2 = await route.fetch(new Request("http://localhost/u-msg_cto/sessions/save", {
      method: "POST",
    }));
    expect(res2.status).toBe(200);
    const body = await res2.json() as { ok: boolean; saved?: { id: string } };
    expect(body.ok).toBe(true);
    expect(body.saved?.id).toBe("sess-a");
    expect(getSession("u-msg_cto").saved).toHaveLength(1);
  });
});

describe("PUT /api/participants/:id/sessions/active", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("set active to null clears active", async () => {
    await setActive("u-msg_cto", "sess-a");
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/u-msg_cto/sessions/active", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: null }),
    }));
    expect(res.status).toBe(200);
    expect(getSession("u-msg_cto").active).toBeNull();
  });

  test("validates sessionId against saved[], 400 if not found", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/u-msg_cto/sessions/active", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "no-such" }),
    }));
    expect(res.status).toBe(400);
  });

  test("switch to saved sessionId succeeds", async () => {
    await setActive("u-msg_cto", "sess-a");
    await saveSession("u-msg_cto");
    await setActive("u-msg_cto", "sess-b");

    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/u-msg_cto/sessions/active", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "sess-a" }),
    }));
    expect(res.status).toBe(200);
    expect(getSession("u-msg_cto").active).toBe("sess-a");
  });
});

describe("PATCH /api/participants/:id/sessions/:sid", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("renames saved session label", async () => {
    await setActive("u-msg_cto", "sess-a");
    await saveSession("u-msg_cto");
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/u-msg_cto/sessions/sess-a", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "my label" }),
    }));
    expect(res.status).toBe(200);
    expect(getSession("u-msg_cto").saved[0].label).toBe("my label");
  });

  test("returns 400 for unknown session", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/u-msg_cto/sessions/no-such", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "x" }),
    }));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/participants/:id/sessions/:sid", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("removes saved session", async () => {
    await setActive("u-msg_cto", "sess-a");
    await saveSession("u-msg_cto");
    await setActive("u-msg_cto", "sess-b");
    await saveSession("u-msg_cto");
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/u-msg_cto/sessions/sess-a", {
      method: "DELETE",
    }));
    expect(res.status).toBe(200);
    expect(getSession("u-msg_cto").saved).toHaveLength(1);
    expect(getSession("u-msg_cto").saved[0].id).toBe("sess-b");
  });
});
