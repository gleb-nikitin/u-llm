import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");
const CONFIG_FILE = join(DATA_DIR, "participants.json");

const MODEL_MAP: Record<string, string> = {
  o: "claude-opus-4-5",
  s: "claude-sonnet-4-5",
  h: "claude-haiku-4-5-20251001",
};

const PERSISTENT_ROLES = new Set(["cto", "secretary", "coo"]);

export interface ParticipantConfig {
  id: string;
  role: string;
  model: string;
  sessionPolicy: "ephemeral" | "persistent";
  rolePrompt: string;
}

interface RawParticipant {
  id: string;
  model?: string;
  rolePrompt?: string;
  sessionPolicy?: "ephemeral" | "persistent";
}

interface RawConfig {
  defaults: {
    model: string;
    rolePrompt: string;
    sessionPolicy: string;
  };
  participants: RawParticipant[];
}

export function parseParticipantId(id: string): {
  project: string;
  role: string;
  model: string;
} {
  const parts = id.split("-");
  if (parts.length < 2) {
    return { project: parts[0] || "", role: "", model: "o" };
  }
  const project = parts[0];
  const role = parts.slice(1, -1).join("-");
  const lastPart = parts[parts.length - 1];

  // If last part is a known model shorthand, use it; otherwise it's part of the role
  if (lastPart in MODEL_MAP) {
    return { project, role: role || lastPart, model: lastPart };
  }
  // No model segment — entire suffix is the role
  return { project, role: parts.slice(1).join("-"), model: "o" };
}

function resolveModel(shorthand: string): string {
  return MODEL_MAP[shorthand] || shorthand;
}

const DEFAULT_CONFIG: RawConfig = {
  defaults: {
    model: "o",
    rolePrompt: "You are a helpful assistant.",
    sessionPolicy: "ephemeral",
  },
  participants: [
    { id: "umsg-cto-o", rolePrompt: "You are CTO." },
    { id: "umsg-exec-s", rolePrompt: "You are Executor." },
    { id: "umsg-audit-s", rolePrompt: "You are Auditor." },
    { id: "umsg-secretary-s", rolePrompt: "You are Secretary." },
  ],
};

function loadRawConfig(): RawConfig {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(CONFIG_FILE)) {
    console.log(
      `[config] ${CONFIG_FILE} not found, creating default config`,
    );
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
    return DEFAULT_CONFIG;
  }
  return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as RawConfig;
}

export function loadParticipants(): ParticipantConfig[] {
  const raw = loadRawConfig();
  const defaults = raw.defaults;

  return raw.participants.map((p) => {
    const parsed = parseParticipantId(p.id);
    // Model override: explicit field > parsed from ID > default
    const modelShort = p.model || parsed.model || defaults.model;
    const model = resolveModel(modelShort);
    const role = parsed.role;
    const sessionPolicy =
      p.sessionPolicy ||
      (PERSISTENT_ROLES.has(role) ? "persistent" : "ephemeral");
    const rolePrompt = p.rolePrompt || defaults.rolePrompt;

    return { id: p.id, role, model, sessionPolicy, rolePrompt } as ParticipantConfig;
  });
}

export function getParticipantConfig(
  participants: ParticipantConfig[],
  participantId: string,
): ParticipantConfig | undefined {
  return participants.find((p) => p.id === participantId);
}
