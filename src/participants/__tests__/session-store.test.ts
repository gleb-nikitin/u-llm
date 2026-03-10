import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from "fs";

// Tests manipulate the real store file. We backup before each test and restore after.

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
  setCurrentSession,
  setSavedSession,
  clearCurrentSession,
  clearSavedSession,
} from "../session-store";

describe("session-store", () => {
  beforeEach(async () => {
    await backupStore();
    clearStore();
  });

  afterEach(async () => {
    await restoreStore();
  });

  test("get empty state returns { current: null, saved: null }", () => {
    const result = getSession("u-msg_cto");
    expect(result).toEqual({ current: null, saved: null });
  });

  test("set current, get returns it", async () => {
    await setCurrentSession("u-msg_cto", "sess-abc");
    const result = getSession("u-msg_cto");
    expect(result.current).toBe("sess-abc");
    expect(result.saved).toBeNull();
  });

  test("set saved, get returns both", async () => {
    await setCurrentSession("u-msg_cto", "sess-abc");
    await setSavedSession("u-msg_cto", "sess-checkpoint");
    const result = getSession("u-msg_cto");
    expect(result.current).toBe("sess-abc");
    expect(result.saved).toBe("sess-checkpoint");
  });

  test("clear current, saved remains", async () => {
    await setCurrentSession("u-msg_cto", "sess-abc");
    await setSavedSession("u-msg_cto", "sess-checkpoint");
    await clearCurrentSession("u-msg_cto");
    const result = getSession("u-msg_cto");
    expect(result.current).toBeNull();
    expect(result.saved).toBe("sess-checkpoint");
  });

  test("clear saved, current remains", async () => {
    await setCurrentSession("u-msg_cto", "sess-abc");
    await setSavedSession("u-msg_cto", "sess-checkpoint");
    await clearSavedSession("u-msg_cto");
    const result = getSession("u-msg_cto");
    expect(result.current).toBe("sess-abc");
    expect(result.saved).toBeNull();
  });

  test("migration: old format { sessionId } → { current, saved: null }", () => {
    writeStore({
      "u-msg_cto": {
        participantId: "u-msg_cto",
        sessionId: "legacy-session-xyz",
        lastUsedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const result = getSession("u-msg_cto");
    expect(result.current).toBe("legacy-session-xyz");
    expect(result.saved).toBeNull();
  });

  test("multiple participants are independent", async () => {
    await setCurrentSession("u-msg_cto", "cto-session");
    await setCurrentSession("u-msg_exec", "exec-session");
    expect(getSession("u-msg_cto").current).toBe("cto-session");
    expect(getSession("u-msg_exec").current).toBe("exec-session");
    await clearCurrentSession("u-msg_cto");
    expect(getSession("u-msg_cto").current).toBeNull();
    expect(getSession("u-msg_exec").current).toBe("exec-session");
  });
});

// --- Handler session logic tests ---

import { resolveSessionOptions } from "../../umsg/handler";
import { createSessionRoute } from "../../routes/session";
import type { ParticipantConfig } from "../config";

describe("handler session logic — unified (no sessionPolicy)", () => {
  test("no sessions → fresh (no resume, no fork), always persist", () => {
    const opts = resolveSessionOptions(null, null);
    expect(opts.resume).toBeUndefined();
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);
  });

  test("has current → resume current, no fork", () => {
    const opts = resolveSessionOptions("current-123", null);
    expect(opts.resume).toBe("current-123");
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);
  });

  test("has saved but no current → fork from saved", () => {
    const opts = resolveSessionOptions(null, "saved-456");
    expect(opts.resume).toBe("saved-456");
    expect(opts.forkSession).toBe(true);
    expect(opts.persistSession).toBe(true);
  });

  test("clear=true → fresh session regardless of current", () => {
    const opts = resolveSessionOptions("current-123", "saved-456", true);
    expect(opts.resume).toBeUndefined();
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);
  });

  test("clear=false → behaves like no clear flag", () => {
    const opts = resolveSessionOptions("current-123", null, false);
    expect(opts.resume).toBe("current-123");
    expect(opts.persistSession).toBe(true);
  });
});

// --- GET /api/participants tests ---

const FIXTURE_PARTICIPANTS: ParticipantConfig[] = [
  { id: "u-msg_cto", project: "u-msg", role: "cto", model: "claude-haiku-4-5-20251001", effort: "medium", rolePrompt: "You are CTO.", projectPath: "/project" },
  { id: "u-msg_exec", project: "u-msg", role: "exec", model: "claude-haiku-4-5-20251001", effort: "medium", rolePrompt: "You are Executor.", projectPath: "/project" },
];

describe("GET /api/participants", () => {
  test("returns all participants with id, role, project, session (no model)", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      id: "u-msg_cto",
      role: "cto",
      project: "u-msg",
      session: { current: null, saved: null },
    });
    expect(body[1]).toEqual({
      id: "u-msg_exec",
      role: "exec",
      project: "u-msg",
      session: { current: null, saved: null },
    });
  });

  test("session is always present (never null), for all participants", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/"));
    const body = await res.json() as Record<string, unknown>[];
    for (const p of body) {
      expect(p.session).not.toBeNull();
      expect(p.session).toBeDefined();
    }
  });

  test("model not in response", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/"));
    const body = await res.json() as Record<string, unknown>[];
    for (const p of body) {
      expect(p.model).toBeUndefined();
    }
  });

  test("does not expose rolePrompt in response", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/"));
    const body = await res.json() as Record<string, unknown>[];
    expect(body[0].rolePrompt).toBeUndefined();
  });
});

describe("POST /api/participants/:id/session", () => {
  test("delete-current returns unknown action error", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/u-msg_cto/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-current" }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  test("all participants accept session actions", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/u-msg_exec/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-saved" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });
});
