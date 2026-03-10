import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");
const CONFIG_FILE = join(DATA_DIR, "participants.json");
const PROMPTS_DIR = join(DATA_DIR, "prompts");

const MODEL_MAP: Record<string, string> = {
  o: "claude-opus-4-5",
  s: "claude-sonnet-4-5",
  h: "claude-haiku-4-5-20251001",
};

const MODEL_LETTERS = new Set(Object.keys(MODEL_MAP));

export interface ParticipantConfig {
  id: string;
  role: string;
  model: string;
  modelShort: string;
  rolePrompt: string;
  projectPath: string;
}

interface RawParticipant {
  id: string;
  model?: string;
  rolePrompt?: string;
  projectPath?: string;
}

interface RawConfig {
  defaults: {
    model: string;
    projectPath?: string;
  };
  participants: RawParticipant[];
}

export function parseParticipantId(id: string): {
  project: string;
  role: string | undefined;
  model: string | undefined;
} {
  if (!id) {
    console.error("[config] empty participant ID");
    return { project: "", role: undefined, model: undefined };
  }

  const parts = id.split("-");

  if (parts.length === 1) {
    console.warn(`[config] single-segment ID "${id}" — using as project name`);
    return { project: parts[0], role: undefined, model: undefined };
  }

  if (parts.length === 2) {
    const [first, last] = parts;
    if (MODEL_LETTERS.has(last)) {
      console.warn(
        `[config] ambiguous 2-segment ID "${id}" — treating as project=${first}, model=${last}`,
      );
      return { project: first, role: undefined, model: last };
    }
    return { project: first, role: last, model: undefined };
  }

  // 3+ segments
  const project = parts[0];
  const lastPart = parts[parts.length - 1];

  if (MODEL_LETTERS.has(lastPart)) {
    const role = parts.slice(1, -1).join("-");
    return { project, role, model: lastPart };
  }

  // Last segment is not a model letter — entire suffix is the role
  const role = parts.slice(1).join("-");
  return { project, role, model: undefined };
}

function resolveModel(shorthand: string): string {
  return MODEL_MAP[shorthand] || shorthand;
}

export function loadRolePrompt(
  rolePromptField: string | undefined,
  role: string,
): { prompt: string; source: string } {
  const INLINE_FALLBACK = "You are a helpful assistant.";

  // 1. Explicit rolePrompt field
  if (rolePromptField) {
    // Check if it looks like a filename (ends with .md or .txt)
    if (rolePromptField.endsWith(".md") || rolePromptField.endsWith(".txt")) {
      const filePath = join(PROMPTS_DIR, rolePromptField);
      if (existsSync(filePath)) {
        return { prompt: readFileSync(filePath, "utf-8").trim(), source: rolePromptField };
      }
      // File specified but not found — fall through to role-based
    } else {
      // Backward compat: inline text, not a filename
      return { prompt: rolePromptField, source: "inline" };
    }
  }

  // 2. Try role-based file
  if (role && role !== "default") {
    const roleFile = join(PROMPTS_DIR, `${role}.md`);
    if (existsSync(roleFile)) {
      return { prompt: readFileSync(roleFile, "utf-8").trim(), source: `${role}.md` };
    }
  }

  // 3. Try default.md
  const defaultFile = join(PROMPTS_DIR, "default.md");
  if (existsSync(defaultFile)) {
    return { prompt: readFileSync(defaultFile, "utf-8").trim(), source: "default.md" };
  }

  // 4. Inline fallback
  return { prompt: INLINE_FALLBACK, source: "inline-fallback" };
}

const DEFAULT_PROJECT_PATH = join(import.meta.dir, "..", "..");

const DEFAULT_CONFIG: RawConfig = {
  defaults: {
    model: "o",
  },
  participants: [
    { id: "umsg-cto-o" },
    { id: "umsg-exec-s" },
    { id: "umsg-audit-s" },
    { id: "umsg-secretary-s" },
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

export function buildParticipants(raw: RawConfig): ParticipantConfig[] {
  const defaults = raw.defaults;
  const results: ParticipantConfig[] = [];

  for (const p of raw.participants) {
    if (!p.id) {
      console.error("[config] skipping participant with empty ID");
      continue;
    }

    const parsed = parseParticipantId(p.id);

    // Model: explicit field > parsed from ID > default
    const modelShort = p.model || parsed.model || defaults.model;
    const model = resolveModel(modelShort);

    // Role: parsed from ID, fallback to "default"
    const role = parsed.role ?? "default";

    // projectPath: explicit per-participant > defaults.projectPath > fallback
    const projectPath = p.projectPath || defaults.projectPath || DEFAULT_PROJECT_PATH;

    // Role prompt: file-based resolution
    const { prompt: rolePrompt, source } = loadRolePrompt(p.rolePrompt, role);

    console.log(
      `[config] ${p.id} → prompts/${source} (${rolePrompt.length} chars)`,
    );

    results.push({ id: p.id, role, model, modelShort: modelShort, rolePrompt, projectPath });
  }

  return results;
}

export function loadParticipants(): ParticipantConfig[] {
  return buildParticipants(loadRawConfig());
}

export function getParticipantConfig(
  participants: ParticipantConfig[],
  participantId: string,
): ParticipantConfig | undefined {
  return participants.find((p) => p.id === participantId);
}
