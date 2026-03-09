import { join } from "path";
import { existsSync, readFileSync, mkdirSync, renameSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");
const STORE_FILE = join(DATA_DIR, "participant-sessions.json");

// Legacy files to archive on first startup
const LEGACY_FILES = ["chain-sessions.json", "sessions.json"];

interface ParticipantSessionEntry {
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

function loadStore(): SessionMap {
  ensureDataDir();
  if (!existsSync(STORE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf-8")) as SessionMap;
  } catch {
    return {};
  }
}

async function saveStore(map: SessionMap): Promise<void> {
  ensureDataDir();
  await Bun.write(STORE_FILE, JSON.stringify(map, null, 2) + "\n");
}

export function getSession(participantId: string): string | undefined {
  const map = loadStore();
  return map[participantId]?.sessionId;
}

export async function setSession(
  participantId: string,
  sessionId: string,
): Promise<void> {
  const map = loadStore();
  map[participantId] = {
    participantId,
    sessionId,
    lastUsedAt: new Date().toISOString(),
  };
  await saveStore(map);
}

export async function clearSession(participantId: string): Promise<void> {
  const map = loadStore();
  delete map[participantId];
  await saveStore(map);
}
