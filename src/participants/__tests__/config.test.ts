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
  const defaults = { model: "o", sessionPolicy: "ephemeral" };

  test("model override in JSON takes precedence over ID-parsed model", () => {
    const raw = {
      defaults,
      participants: [{ id: "umsg-cto-o", model: "h" }],
    };
    const result = buildParticipants(raw);
    expect(result[0].model).toBe("claude-haiku-4-5-20251001");
  });

  test("session policy inferred from role (cto → persistent, exec → ephemeral)", () => {
    const raw = {
      defaults,
      participants: [
        { id: "umsg-cto-o" },
        { id: "umsg-exec-s" },
      ],
    };
    const result = buildParticipants(raw);
    expect(result[0].sessionPolicy).toBe("persistent");
    expect(result[1].sessionPolicy).toBe("ephemeral");
  });

  test("explicit sessionPolicy in JSON overrides inference", () => {
    const raw = {
      defaults,
      participants: [
        { id: "umsg-cto-o", sessionPolicy: "ephemeral" as const },
      ],
    };
    const result = buildParticipants(raw);
    expect(result[0].sessionPolicy).toBe("ephemeral");
  });

  test("defaults.model applied when parser returns model=undefined", () => {
    const raw = {
      defaults: { model: "h", sessionPolicy: "ephemeral" },
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
});
