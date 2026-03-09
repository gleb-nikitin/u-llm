import { join } from "path";
import { existsSync, mkdirSync, readFileSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");
const MAP_FILE = join(DATA_DIR, "chain-sessions.json");

interface ChainSessionEntry {
  session_id: string;
  last_used_at: string;
}

type ChainSessionMap = Record<string, ChainSessionEntry>;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadMap(): ChainSessionMap {
  ensureDataDir();
  if (!existsSync(MAP_FILE)) return {};
  try {
    return JSON.parse(readFileSync(MAP_FILE, "utf-8")) as ChainSessionMap;
  } catch {
    return {};
  }
}

async function saveMap(map: ChainSessionMap): Promise<void> {
  ensureDataDir();
  await Bun.write(MAP_FILE, JSON.stringify(map, null, 2) + "\n");
}

export async function setChainSession(
  chainId: string,
  sessionId: string,
): Promise<void> {
  const map = loadMap();
  map[chainId] = {
    session_id: sessionId,
    last_used_at: new Date().toISOString(),
  };
  await saveMap(map);
}

export function getChainSession(chainId: string): string | undefined {
  const map = loadMap();
  return map[chainId]?.session_id;
}
