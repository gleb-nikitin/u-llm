import { join } from "path";
import { existsSync, readFileSync, mkdirSync, renameSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");
const STORE_FILE = join(DATA_DIR, "participant-sessions.json");

// Legacy files to archive on first startup
const LEGACY_FILES = ["chain-sessions.json", "sessions.json"];

interface ParticipantSessionEntry {
  participantId: string;
  currentSessionId: string | null;
  savedSessionId: string | null;
  lastUsedAt: string;
}

// Old format before spec 008
interface LegacyEntry {
  participantId: string;
  sessionId: string;
  lastUsedAt: string;
}

type SessionMap = Record<string, ParticipantSessionEntry>;

let archiveDone = false;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function archiveLegacyFiles(): void {
  if (archiveDone) return;
  archiveDone = true;
  ensureDataDir();
  for (const file of LEGACY_FILES) {
    const src = join(DATA_DIR, file);
    const dst = join(DATA_DIR, file + ".bak");
    if (existsSync(src) && !existsSync(dst)) {
      renameSync(src, dst);
      console.log(`[session-store] archived ${file} → ${file}.bak`);
    }
  }
}

function migrateEntry(raw: LegacyEntry | ParticipantSessionEntry): ParticipantSessionEntry {
  if ("sessionId" in raw && !("currentSessionId" in raw)) {
    return {
      participantId: raw.participantId,
      currentSessionId: (raw as LegacyEntry).sessionId,
      savedSessionId: null,
      lastUsedAt: raw.lastUsedAt,
    };
  }
  return raw as ParticipantSessionEntry;
}

function loadStore(): SessionMap {
  ensureDataDir();
  if (!existsSync(STORE_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(STORE_FILE, "utf-8")) as Record<
      string,
      LegacyEntry | ParticipantSessionEntry
    >;
    const migrated: SessionMap = {};
    for (const [k, v] of Object.entries(raw)) {
      migrated[k] = migrateEntry(v);
    }
    return migrated;
  } catch {
    return {};
  }
}

async function saveStore(map: SessionMap): Promise<void> {
  ensureDataDir();
  await Bun.write(STORE_FILE, JSON.stringify(map, null, 2) + "\n");
}

function getOrCreate(map: SessionMap, participantId: string): ParticipantSessionEntry {
  if (!map[participantId]) {
    map[participantId] = {
      participantId,
      currentSessionId: null,
      savedSessionId: null,
      lastUsedAt: new Date().toISOString(),
    };
  }
  return map[participantId];
}

export function getSession(
  participantId: string,
): { current: string | null; saved: string | null } {
  const map = loadStore();
  const entry = map[participantId];
  if (!entry) return { current: null, saved: null };
  return { current: entry.currentSessionId, saved: entry.savedSessionId };
}

export async function setCurrentSession(
  participantId: string,
  sessionId: string,
): Promise<void> {
  const map = loadStore();
  const entry = getOrCreate(map, participantId);
  entry.currentSessionId = sessionId;
  entry.lastUsedAt = new Date().toISOString();
  await saveStore(map);
}

export async function setSavedSession(
  participantId: string,
  sessionId: string,
): Promise<void> {
  const map = loadStore();
  const entry = getOrCreate(map, participantId);
  entry.savedSessionId = sessionId;
  entry.lastUsedAt = new Date().toISOString();
  await saveStore(map);
}

export async function clearCurrentSession(participantId: string): Promise<void> {
  const map = loadStore();
  if (!map[participantId]) return;
  map[participantId].currentSessionId = null;
  map[participantId].lastUsedAt = new Date().toISOString();
  await saveStore(map);
}

export async function clearSavedSession(participantId: string): Promise<void> {
  const map = loadStore();
  if (!map[participantId]) return;
  map[participantId].savedSessionId = null;
  map[participantId].lastUsedAt = new Date().toISOString();
  await saveStore(map);
}
