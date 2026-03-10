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
    const result = getSession("umsg-cto-o");
    expect(result).toEqual({ current: null, saved: null });
  });

  test("set current, get returns it", async () => {
    await setCurrentSession("umsg-cto-o", "sess-abc");
    const result = getSession("umsg-cto-o");
    expect(result.current).toBe("sess-abc");
    expect(result.saved).toBeNull();
  });

  test("set saved, get returns both", async () => {
    await setCurrentSession("umsg-cto-o", "sess-abc");
    await setSavedSession("umsg-cto-o", "sess-checkpoint");
    const result = getSession("umsg-cto-o");
    expect(result.current).toBe("sess-abc");
    expect(result.saved).toBe("sess-checkpoint");
  });

  test("clear current, saved remains", async () => {
    await setCurrentSession("umsg-cto-o", "sess-abc");
    await setSavedSession("umsg-cto-o", "sess-checkpoint");
    await clearCurrentSession("umsg-cto-o");
    const result = getSession("umsg-cto-o");
    expect(result.current).toBeNull();
    expect(result.saved).toBe("sess-checkpoint");
  });

  test("clear saved, current remains", async () => {
    await setCurrentSession("umsg-cto-o", "sess-abc");
    await setSavedSession("umsg-cto-o", "sess-checkpoint");
    await clearSavedSession("umsg-cto-o");
    const result = getSession("umsg-cto-o");
    expect(result.current).toBe("sess-abc");
    expect(result.saved).toBeNull();
  });

  test("migration: old format { sessionId } → { current, saved: null }", () => {
    writeStore({
      "umsg-cto-o": {
        participantId: "umsg-cto-o",
        sessionId: "legacy-session-xyz",
        lastUsedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const result = getSession("umsg-cto-o");
    expect(result.current).toBe("legacy-session-xyz");
    expect(result.saved).toBeNull();
  });

  test("multiple participants are independent", async () => {
    await setCurrentSession("umsg-cto-o", "cto-session");
    await setCurrentSession("umsg-exec-s", "exec-session");
    expect(getSession("umsg-cto-o").current).toBe("cto-session");
    expect(getSession("umsg-exec-s").current).toBe("exec-session");
    await clearCurrentSession("umsg-cto-o");
    expect(getSession("umsg-cto-o").current).toBeNull();
    expect(getSession("umsg-exec-s").current).toBe("exec-session");
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
  { id: "test-cto-o", role: "cto", model: "claude-opus-4-5", modelShort: "o", rolePrompt: "You are CTO.", projectPath: "/project" },
  { id: "test-exec-s", role: "exec", model: "claude-sonnet-4-5", modelShort: "s", rolePrompt: "You are Executor.", projectPath: "/project" },
];

describe("GET /api/participants", () => {
  test("returns all participants with id, role, model, session (no sessionPolicy)", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      id: "test-cto-o",
      role: "cto",
      model: "o",
      session: { current: null, saved: null },
    });
    expect(body[1]).toEqual({
      id: "test-exec-s",
      role: "exec",
      model: "s",
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

  test("sessionPolicy not in response", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/"));
    const body = await res.json() as Record<string, unknown>[];
    for (const p of body) {
      expect(p.sessionPolicy).toBeUndefined();
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
    const res = await route.fetch(new Request("http://localhost/test-cto-o/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-current" }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  test("ephemeral guard removed — all participants accept session actions", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    // exec used to be "ephemeral" and would get a 400; now it should not be blocked
    const res = await route.fetch(new Request("http://localhost/test-exec-s/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-saved" }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });
});
