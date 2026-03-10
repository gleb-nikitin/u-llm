import { describe, test, expect } from "bun:test";
import { loadRolePrompt, buildParticipants } from "../config";

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
  const baseConfig = {
    defaultModel: "claude-haiku-4-5-20251001",
    defaultEffort: "medium",
  };

  test("explicit project and role fields are used directly", () => {
    const raw = {
      ...baseConfig,
      participants: [{ id: "u-msg_cto", project: "u-msg", role: "cto" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].project).toBe("u-msg");
    expect(result[0].role).toBe("cto");
    expect(result[0].id).toBe("u-msg_cto");
  });

  test("model comes from defaultModel", () => {
    const raw = {
      ...baseConfig,
      participants: [{ id: "u-msg_cto", project: "u-msg", role: "cto" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].model).toBe("claude-haiku-4-5-20251001");
  });

  test("effort comes from defaultEffort", () => {
    const raw = {
      ...baseConfig,
      participants: [{ id: "u-msg_cto", project: "u-msg", role: "cto" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].effort).toBe("medium");
  });

  test("effort defaults to medium when omitted", () => {
    const raw = {
      defaultModel: "claude-haiku-4-5-20251001",
      participants: [{ id: "u-msg_cto", project: "u-msg", role: "cto" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].effort).toBe("medium");
  });

  test("all participants share defaultModel (no per-participant model)", () => {
    const raw = {
      ...baseConfig,
      participants: [
        { id: "u-msg_cto", project: "u-msg", role: "cto" },
        { id: "u-msg_exec", project: "u-msg", role: "exec" },
      ],
    };
    const result = buildParticipants(raw);
    expect(result[0].model).toBe(result[1].model);
  });

  test("empty participant ID is skipped", () => {
    const raw = {
      ...baseConfig,
      participants: [
        { id: "", project: "u-msg", role: "cto" },
        { id: "u-msg_exec", project: "u-msg", role: "exec" },
      ],
    };
    const result = buildParticipants(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u-msg_exec");
  });

  test("projectPath per-participant overrides default", () => {
    const raw = {
      ...baseConfig,
      participants: [{ id: "u-msg_cto", project: "u-msg", role: "cto", projectPath: "/my/project" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].projectPath).toBe("/my/project");
  });

  test("projectPath fallback when not in config", () => {
    const raw = {
      ...baseConfig,
      participants: [{ id: "u-msg_cto", project: "u-msg", role: "cto" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].projectPath).toBeTruthy();
    expect(typeof result[0].projectPath).toBe("string");
  });

  test("no modelShort or sessionPolicy in output", () => {
    const raw = {
      ...baseConfig,
      participants: [{ id: "u-msg_cto", project: "u-msg", role: "cto" }],
    };
    const result = buildParticipants(raw);
    expect(result[0]).not.toHaveProperty("modelShort");
    expect(result[0]).not.toHaveProperty("sessionPolicy");
  });
});
