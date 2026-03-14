import { join } from "path";
import { existsSync, readFileSync, mkdirSync, renameSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");
const STORE_FILE = join(DATA_DIR, "participant-sessions.json");

// Legacy files to archive on first startup
const LEGACY_FILES = ["chain-sessions.json", "sessions.json"];

export interface SavedSession {
  id: string;
  label: string | null;
  savedAt: string;
}

interface ParticipantSessionEntry {
  participantId: string;
  active: string | null;
  saved: SavedSession[];
  lastUsedAt: string;
}

// V1: before spec 008
interface LegacyEntryV1 {
  participantId: string;
  sessionId: string;
  lastUsedAt: string;
}

// V2: spec 008 era
interface LegacyEntryV2 {
  participantId: string;
  currentSessionId: string | null;
  savedSessionId: string | null;
  lastUsedAt: string;
}

// V3: spec 020 v1 (wrong semantics)
interface LegacyEntryV3 {
  participantId: string;
  activeSessionId: string | null;
  sessions: Array<{ id: string; label: string | null; createdAt: string; lastUsedAt: string }>;
  lastUsedAt: string;
}

type RawEntry = LegacyEntryV1 | LegacyEntryV2 | LegacyEntryV3 | ParticipantSessionEntry;
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

function migrateEntry(raw: RawEntry): ParticipantSessionEntry {
  // V4: already current format — has `active` and `saved` fields
  if ("active" in raw && "saved" in raw) {
    return raw as ParticipantSessionEntry;
  }

  // V3: { activeSessionId, sessions: SessionSlot[] }
  if ("activeSessionId" in raw && "sessions" in raw) {
    const v3 = raw as LegacyEntryV3;
    return {
      participantId: v3.participantId,
      active: v3.activeSessionId,
      saved: v3.sessions.map((s) => ({
        id: s.id,
        label: s.label,
        savedAt: s.createdAt,
      })),
      lastUsedAt: v3.lastUsedAt,
    };
  }

  // V2: { currentSessionId, savedSessionId }
  if ("currentSessionId" in raw) {
    const v2 = raw as LegacyEntryV2;
    const saved: SavedSession[] = [];
    if (v2.savedSessionId) {
      saved.push({ id: v2.savedSessionId, label: null, savedAt: v2.lastUsedAt });
    }
    return {
      participantId: v2.participantId,
      active: v2.currentSessionId,
      saved,
      lastUsedAt: v2.lastUsedAt,
    };
  }

  // V1: { sessionId }
  const v1 = raw as LegacyEntryV1;
  return {
    participantId: v1.participantId,
    active: v1.sessionId,
    saved: [],
    lastUsedAt: v1.lastUsedAt,
  };
}

function loadStore(): SessionMap {
  ensureDataDir();
  if (!existsSync(STORE_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(STORE_FILE, "utf-8")) as Record<string, RawEntry>;
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
      active: null,
      saved: [],
      lastUsedAt: new Date().toISOString(),
    };
  }
  return map[participantId];
}

export function getSession(
  participantId: string,
): { active: string | null; saved: SavedSession[] } {
  const map = loadStore();
  const entry = map[participantId];
  if (!entry) return { active: null, saved: [] };
  return { active: entry.active, saved: entry.saved };
}

export async function setActive(
  participantId: string,
  sessionId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const map = loadStore();
  const entry = getOrCreate(map, participantId);
  entry.active = sessionId;
  entry.lastUsedAt = now;
  await saveStore(map);
}

export async function saveSession(
  participantId: string,
): Promise<{ ok: boolean; error?: string; saved?: SavedSession }> {
  const map = loadStore();
  const entry = getOrCreate(map, participantId);

  if (!entry.active) {
    return { ok: false, error: "no active session to save" };
  }

  const existing = entry.saved.find((s) => s.id === entry.active);
  if (existing) {
    return { ok: true, saved: existing };
  }

  const saved: SavedSession = {
    id: entry.active,
    label: null,
    savedAt: new Date().toISOString(),
  };
  entry.saved.push(saved);
  await saveStore(map);
  return { ok: true, saved };
}

export async function deleteSaved(
  participantId: string,
  sessionId: string,
): Promise<void> {
  const map = loadStore();
  const entry = map[participantId];
  if (!entry) return;
  entry.saved = entry.saved.filter((s) => s.id !== sessionId);
  if (entry.active === sessionId) entry.active = null;
  entry.lastUsedAt = new Date().toISOString();
  await saveStore(map);
}

export async function labelSaved(
  participantId: string,
  sessionId: string,
  label: string,
): Promise<{ ok: boolean; error?: string }> {
  const map = loadStore();
  const entry = map[participantId];
  if (!entry) return { ok: false, error: "participant not found" };
  const slot = entry.saved.find((s) => s.id === sessionId);
  if (!slot) return { ok: false, error: "session not found" };
  slot.label = label;
  await saveStore(map);
  return { ok: true };
}

export async function clearActive(participantId: string): Promise<void> {
  const map = loadStore();
  if (!map[participantId]) return;
  map[participantId].active = null;
  map[participantId].lastUsedAt = new Date().toISOString();
  await saveStore(map);
}
