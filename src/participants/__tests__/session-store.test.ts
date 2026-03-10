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

describe("handler session logic", () => {
  test("persistent role, no sessions → fresh session (no resume, no fork)", () => {
    const opts = resolveSessionOptions("persistent", null, null);
    expect(opts.resume).toBeUndefined();
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);
  });

  test("persistent role, has current → resume current, no fork", () => {
    const opts = resolveSessionOptions("persistent", "current-123", null);
    expect(opts.resume).toBe("current-123");
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(true);
  });

  test("persistent role, has saved but no current → fork from saved", () => {
    const opts = resolveSessionOptions("persistent", null, "saved-456");
    expect(opts.resume).toBe("saved-456");
    expect(opts.forkSession).toBe(true);
    expect(opts.persistSession).toBe(true);
  });

  test("ephemeral role → always fresh, no session stored", () => {
    const opts = resolveSessionOptions("ephemeral", null, null);
    expect(opts.resume).toBeUndefined();
    expect(opts.forkSession).toBeUndefined();
    expect(opts.persistSession).toBe(false);
  });
});

// --- GET /api/participants tests ---

const FIXTURE_PARTICIPANTS: ParticipantConfig[] = [
  { id: "umsg-cto-o", role: "cto", model: "claude-opus-4-5", modelShort: "o", sessionPolicy: "persistent", rolePrompt: "You are CTO." },
  { id: "umsg-exec-s", role: "exec", model: "claude-sonnet-4-5", modelShort: "s", sessionPolicy: "ephemeral", rolePrompt: "You are Executor." },
];

describe("GET /api/participants", () => {
  test("returns all participants with id, role, model, sessionPolicy", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      id: "umsg-cto-o",
      role: "cto",
      model: "o",
      sessionPolicy: "persistent",
      session: { current: null, saved: null },
    });
    expect(body[1]).toEqual({
      id: "umsg-exec-s",
      role: "exec",
      model: "s",
      sessionPolicy: "ephemeral",
      session: null,
    });
  });

  test("does not expose rolePrompt in response", async () => {
    const route = createSessionRoute(FIXTURE_PARTICIPANTS);
    const res = await route.fetch(new Request("http://localhost/"));
    const body = await res.json() as Record<string, unknown>[];
    expect(body[0].rolePrompt).toBeUndefined();
  });
});
