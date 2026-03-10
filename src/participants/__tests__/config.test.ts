import { describe, test, expect } from "bun:test";
import { parseParticipantId, loadRolePrompt, buildParticipants } from "../config";

// --- parseParticipantId tests ---

describe("parseParticipantId", () => {
  test("standard 3-segment ID", () => {
    const result = parseParticipantId("umsg-cto-o");
    expect(result).toEqual({ project: "umsg", role: "cto", model: "o" });
  });

  test("standard with sonnet model", () => {
    const result = parseParticipantId("umsg-exec-s");
    expect(result).toEqual({ project: "umsg", role: "exec", model: "s" });
  });

  test("multi-segment role", () => {
    const result = parseParticipantId("umsg-dev-ops-s");
    expect(result).toEqual({ project: "umsg", role: "dev-ops", model: "s" });
  });

  test("no model suffix (2 segments, last not model letter)", () => {
    const result = parseParticipantId("umsg-cto");
    expect(result).toEqual({ project: "umsg", role: "cto", model: undefined });
  });

  test("ambiguous 2-segment with model letter", () => {
    const result = parseParticipantId("umsg-o");
    expect(result).toEqual({
      project: "umsg",
      role: undefined,
      model: "o",
    });
  });

  test("single segment", () => {
    const result = parseParticipantId("cto");
    expect(result).toEqual({
      project: "cto",
      role: undefined,
      model: undefined,
    });
  });

  test("empty string", () => {
    const result = parseParticipantId("");
    expect(result).toEqual({
      project: "",
      role: undefined,
      model: undefined,
    });
  });

  test("3+ segments, last not a model letter", () => {
    const result = parseParticipantId("umsg-dev-ops");
    expect(result).toEqual({
      project: "umsg",
      role: "dev-ops",
      model: undefined,
    });
  });

  test("haiku model letter", () => {
    const result = parseParticipantId("myapp-worker-h");
    expect(result).toEqual({ project: "myapp", role: "worker", model: "h" });
  });
});

// --- loadRolePrompt tests ---

describe("loadRolePrompt", () => {
  test("explicit rolePrompt filename loads that file", () => {
    const result = loadRolePrompt("cto.md", "cto");
    expect(result.prompt).toBe(
      "You are CTO. You architect systems, write specs, and make technical decisions.",
    );
    expect(result.source).toBe("cto.md");
  });

  test("missing rolePrompt falls back to {role}.md", () => {
    const result = loadRolePrompt(undefined, "cto");
    expect(result.prompt).toBe(
      "You are CTO. You architect systems, write specs, and make technical decisions.",
    );
    expect(result.source).toBe("cto.md");
  });

  test("missing role file falls back to default.md", () => {
    const result = loadRolePrompt(undefined, "nonexistent-role");
    expect(result.prompt).toBe("You are a helpful assistant.");
    expect(result.source).toBe("default.md");
  });

  test("inline text (backward compat) is returned as-is", () => {
    const result = loadRolePrompt("You are a special bot.", "cto");
    expect(result.prompt).toBe("You are a special bot.");
    expect(result.source).toBe("inline");
  });

  test("explicit filename that doesn't exist falls back to role file", () => {
    const result = loadRolePrompt("missing-file.md", "cto");
    expect(result.prompt).toBe(
      "You are CTO. You architect systems, write specs, and make technical decisions.",
    );
    expect(result.source).toBe("cto.md");
  });

  test("role=default loads default.md", () => {
    const result = loadRolePrompt(undefined, "default");
    expect(result.prompt).toBe("You are a helpful assistant.");
    expect(result.source).toBe("default.md");
  });
});

// --- buildParticipants tests ---

describe("buildParticipants", () => {
  const defaults = { model: "o" };

  test("model override in JSON takes precedence over ID-parsed model", () => {
    const raw = {
      defaults,
      participants: [{ id: "umsg-cto-o", model: "h" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].model).toBe("claude-haiku-4-5-20251001");
  });

  test("all roles get session management (no sessionPolicy field)", () => {
    const raw = {
      defaults,
      participants: [
        { id: "umsg-cto-o" },
        { id: "umsg-exec-s" },
      ],
    };
    const result = buildParticipants(raw);
    expect(result[0]).not.toHaveProperty("sessionPolicy");
    expect(result[1]).not.toHaveProperty("sessionPolicy");
  });

  test("defaults.model applied when parser returns model=undefined", () => {
    const raw = {
      defaults: { model: "h" },
      participants: [{ id: "umsg-cto" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].model).toBe("claude-haiku-4-5-20251001");
  });

  test("empty participant ID is skipped", () => {
    const raw = {
      defaults,
      participants: [{ id: "" }, { id: "umsg-exec-s" }],
    };
    const result = buildParticipants(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("umsg-exec-s");
  });

  test("projectPath from defaults", () => {
    const raw = {
      defaults: { model: "o", projectPath: "/custom/path" },
      participants: [{ id: "umsg-cto-o" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].projectPath).toBe("/custom/path");
  });

  test("projectPath per-participant overrides defaults", () => {
    const raw = {
      defaults: { model: "o", projectPath: "/default/path" },
      participants: [{ id: "umsg-cto-o", projectPath: "/my/project" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].projectPath).toBe("/my/project");
  });

  test("projectPath fallback when not in config", () => {
    const raw = {
      defaults: { model: "o" },
      participants: [{ id: "umsg-cto-o" }],
    };
    const result = buildParticipants(raw);
    // Fallback is join(import.meta.dir, "..", "..") which resolves to project root
    expect(result[0].projectPath).toBeTruthy();
    expect(typeof result[0].projectPath).toBe("string");
  });
});
