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

interface SessionEntry {
  participantId: string;
  currentSessionId: string | null;
  savedSessionId: string | null;
  lastUsedAt: string;
}

interface SessionStore {
  [participantId: string]: SessionEntry;
}

function loadSessionStore(): SessionStore {
  if (!existsSync(STORE_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf-8")) as SessionStore;
  } catch {
    return {};
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function findSession(participantId: string) {
  const store = loadSessionStore();
  const entry = store[participantId];

  if (!entry) {
    console.log(`❌ No session entry found for participant: ${participantId}`);
    console.log(`\nAvailable participants:`);
    for (const pid of Object.keys(store)) {
      console.log(`  - ${pid}`);
    }
    process.exit(1);
  }

  console.log(`\n📍 Session Location for ${participantId}\n`);

  // Current session
  if (entry.currentSessionId) {
    const sessionPath = join(
      DATA_DIR,
      "sessions",
      participantId,
      entry.currentSessionId,
      "current.jsonl",
    );
    const exists = existsSync(sessionPath);
    const size = exists ? formatSize(statSync(sessionPath).size) : "N/A";

    console.log(`Current Session:`);
    console.log(`  ID: ${entry.currentSessionId}`);
    console.log(`  Path: ${sessionPath}`);
    console.log(`  Size: ${size}`);
    console.log(`  Status: ${exists ? "✅ Active" : "❌ File not found"}`);
  } else {
    console.log(`Current Session: (none)`);
  }

  // Saved session
  if (entry.savedSessionId) {
    const sessionPath = join(
      DATA_DIR,
      "sessions",
      participantId,
      entry.savedSessionId,
      "current.jsonl",
    );
    const exists = existsSync(sessionPath);
    const size = exists ? formatSize(statSync(sessionPath).size) : "N/A";

    console.log(`\nSaved Session:`);
    console.log(`  ID: ${entry.savedSessionId}`);
    console.log(`  Path: ${sessionPath}`);
    console.log(`  Size: ${size}`);
    console.log(`  Status: ${exists ? "✅ Persisted" : "❌ File not found"}`);
  } else {
    console.log(`\nSaved Session: (none)`);
  }

  console.log(`\nLast Used: ${entry.lastUsedAt}\n`);
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: bun scripts/find-session.ts <participantId>");
  console.error("Example: bun scripts/find-session.ts u-llm_cto");
  process.exit(1);
}

findSession(args[0]);
