#!/usr/bin/env bun
/**
 * Find session location for a participant
 * Usage: bun scripts/find-session.ts <participantId>
 * Example: bun scripts/find-session.ts u-llm_cto
 */

import { join } from "path";
import { existsSync, readFileSync, statSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "data");
const STORE_FILE = join(DATA_DIR, "participant-sessions.json");

interface SavedSession {
  id: string;
  label: string | null;
  savedAt: string;
}

// V4 format (current)
interface V4Entry {
  participantId: string;
  active: string | null;
  saved: SavedSession[];
  lastUsedAt: string;
}

// V3 format (spec 020 v1)
interface V3Entry {
  participantId: string;
  activeSessionId: string | null;
  sessions: Array<{ id: string; label: string | null; createdAt: string; lastUsedAt: string }>;
  lastUsedAt: string;
}

// Legacy formats (pre-020)
interface LegacyEntry {
  participantId: string;
  currentSessionId?: string | null;
  savedSessionId?: string | null;
  sessionId?: string;
  lastUsedAt: string;
}

type RawEntry = V4Entry | V3Entry | LegacyEntry;

function loadStore(): Record<string, RawEntry> {
  if (!existsSync(STORE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function normalize(raw: RawEntry): V4Entry {
  // V4: { active, saved }
  if ("active" in raw && "saved" in raw) return raw as V4Entry;

  // V3: { activeSessionId, sessions }
  if ("activeSessionId" in raw && "sessions" in raw) {
    const v3 = raw as V3Entry;
    return {
      participantId: v3.participantId,
      active: v3.activeSessionId,
      saved: v3.sessions.map((s) => ({ id: s.id, label: s.label, savedAt: s.createdAt })),
      lastUsedAt: v3.lastUsedAt,
    };
  }

  // V1/V2 legacy
  const legacy = raw as LegacyEntry;
  const saved: SavedSession[] = [];
  const ts = legacy.lastUsedAt;
  const currentId = legacy.currentSessionId ?? (legacy as { sessionId?: string }).sessionId ?? null;
  if (legacy.savedSessionId) saved.push({ id: legacy.savedSessionId, label: null, savedAt: ts });
  return { participantId: legacy.participantId, active: currentId, saved, lastUsedAt: ts };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function findSession(participantId: string) {
  const store = loadStore();
  const raw = store[participantId];

  if (!raw) {
    console.log(`No session entry found for participant: ${participantId}`);
    console.log(`\nAvailable participants:`);
    for (const pid of Object.keys(store)) {
      console.log(`  - ${pid}`);
    }
    process.exit(1);
  }

  const entry = normalize(raw);
  const projectDir = join(import.meta.dir, "..");
  const encodedCwd = projectDir.replace(/\//g, "-");
  const claudeDir = join(process.env.HOME!, ".claude", "projects", encodedCwd);

  console.log(`\nSessions for ${participantId}\n`);
  console.log(`Active: ${entry.active ?? "(none)"}`);
  console.log(`Saved checkpoints: ${entry.saved.length}`);
  console.log(`Last used: ${entry.lastUsedAt}\n`);

  // Show active session info if it exists and isn't in saved
  if (entry.active) {
    const isInSaved = entry.saved.some((s) => s.id === entry.active);
    if (!isInSaved) {
      const jsonlPath = join(claudeDir, `${entry.active}.jsonl`);
      const exists = existsSync(jsonlPath);
      const size = exists ? formatSize(statSync(jsonlPath).size) : "N/A";
      console.log(`  * ${entry.active}  (active, not saved)`);
      console.log(`    Size: ${size}`);
      if (!exists) console.log(`    (session file not found at ${jsonlPath})`);
    }
  }

  for (const slot of entry.saved) {
    const isActive = slot.id === entry.active;
    const jsonlPath = join(claudeDir, `${slot.id}.jsonl`);
    const exists = existsSync(jsonlPath);
    const size = exists ? formatSize(statSync(jsonlPath).size) : "N/A";

    console.log(`  ${isActive ? "* " : "  "}${slot.id}${isActive ? "  (active)" : ""}`);
    if (slot.label) console.log(`    Label: ${slot.label}`);
    console.log(`    Size: ${size}  Saved: ${slot.savedAt}`);
    if (!exists) console.log(`    (session file not found at ${jsonlPath})`);
  }

  if (!entry.active && entry.saved.length === 0) {
    console.log("  (no sessions)");
  }
  console.log("");
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: bun scripts/find-session.ts <participantId>");
  console.error("Example: bun scripts/find-session.ts u-llm_cto");
  process.exit(1);
}

findSession(args[0]);
