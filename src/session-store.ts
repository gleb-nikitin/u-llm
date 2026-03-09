import { join } from "path";
import { existsSync, mkdirSync, readFileSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "data");
const SESSIONS_FILE = join(DATA_DIR, "sessions.json");

export interface SessionEntry {
  session_id: string;
  created_at: string;
  last_used_at: string;
  prompt_preview: string;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadSessions(): SessionEntry[] {
  ensureDataDir();
  if (!existsSync(SESSIONS_FILE)) return [];
  try {
    const text = readFileSync(SESSIONS_FILE, "utf-8");
    return JSON.parse(text) as SessionEntry[];
  } catch {
    return [];
  }
}

export async function saveSessions(sessions: SessionEntry[]): Promise<void> {
  ensureDataDir();
  await Bun.write(SESSIONS_FILE, JSON.stringify(sessions, null, 2) + "\n");
}

export async function upsertSession(
  sessionId: string,
  prompt: string,
): Promise<void> {
  const sessions = loadSessions();
  const now = new Date().toISOString();
  const preview = prompt.slice(0, 80);

  const existing = sessions.find((s) => s.session_id === sessionId);
  if (existing) {
    existing.last_used_at = now;
    existing.prompt_preview = preview;
  } else {
    sessions.push({
      session_id: sessionId,
      created_at: now,
      last_used_at: now,
      prompt_preview: preview,
    });
  }

  await saveSessions(sessions);
}

export function getLatestSessionId(): string | undefined {
  const sessions = loadSessions();
  if (sessions.length === 0) return undefined;
  sessions.sort(
    (a, b) =>
      new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime(),
  );
  return sessions[0].session_id;
}

export function listSessions(): void {
  const sessions = loadSessions();
  if (sessions.length === 0) {
    console.log("No sessions stored.");
    return;
  }
  sessions.sort(
    (a, b) =>
      new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime(),
  );
  for (const s of sessions) {
    console.log(
      `${s.session_id}  last_used=${s.last_used_at}  "${s.prompt_preview}"`,
    );
  }
}
