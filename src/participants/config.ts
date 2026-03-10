import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const DATA_DIR = join(import.meta.dir, "..", "..", "data");
const CONFIG_FILE = join(DATA_DIR, "participants.json");
const PROMPTS_DIR = join(DATA_DIR, "prompts");

export interface ParticipantConfig {
  id: string;
  project: string;
  role: string;
  model: string;
  effort: string;
  rolePrompt: string;
  projectPath: string;
}

interface RawParticipant {
  id: string;
  project: string;
  role: string;
  projectPath?: string;
  rolePrompt?: string;
}

interface RawConfig {
  defaultModel: string;
  defaultEffort?: string;
  participants: RawParticipant[];
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
  defaultModel: "claude-haiku-4-5-20251001",
  defaultEffort: "medium",
  participants: [
    { id: "u-msg_cto", project: "u-msg", role: "cto" },
    { id: "u-msg_exec", project: "u-msg", role: "exec" },
    { id: "u-msg_audit", project: "u-msg", role: "audit" },
    { id: "u-msg_secretary", project: "u-msg", role: "secretary" },
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
  const model = raw.defaultModel;
  const effort = raw.defaultEffort ?? "medium";
  const results: ParticipantConfig[] = [];

  for (const p of raw.participants) {
    if (!p.id) {
      console.error("[config] skipping participant with empty ID");
      continue;
    }

    const role = p.role || "default";
    const project = p.project || "";
    const projectPath = p.projectPath || DEFAULT_PROJECT_PATH;

    // Role prompt: file-based resolution
    const { prompt: rolePrompt, source } = loadRolePrompt(p.rolePrompt, role);

    console.log(
      `[config] ${p.id} → prompts/${source} (${rolePrompt.length} chars)`,
    );

    results.push({ id: p.id, project, role, model, effort, rolePrompt, projectPath });
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
