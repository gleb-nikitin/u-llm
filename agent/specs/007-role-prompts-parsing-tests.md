# Spec 007 — Role Prompts, Parsing Hardening, Full Content, Tests

## Goal
Make role prompts useful, harden participant ID parsing for edge cases, give all participants full message content, and introduce test coverage for the config/parsing layer.

## Background
- Role prompts are currently stubs: "You are CTO.", "You are Executor." — no real instructions.
- `parseParticipantId` breaks on edge cases: empty model, empty role, single-segment IDs, IDs without model suffix.
- Persistent roles get truncated summary instead of full content — unnecessary limitation, all participants should get full content.
- Zero test coverage. Config/parsing is the first module that genuinely benefits from tests.

## Reference
- `agent/specs/006-multi-participant-sessions.md` — current participant config design.
- `src/participants/config.ts` — current parsing + config loading.
- `src/umsg/handler.ts` — current prompt routing (summary vs full).
- `data/participants.json` — runtime participant config.

---

## Deliverables

### D1: Role Prompt Files (`data/prompts/`)

Move role prompts out of `participants.json` into separate text files. Prompts will grow — multi-line instructions don't belong in JSON.

**Directory**: `data/prompts/`
**Convention**: one file per role, named `{role}.md` (e.g. `cto.md`, `exec.md`, `audit.md`, `secretary.md`).

**Config change** in `data/participants.json`:
```json
{
  "defaults": {
    "model": "o",
    "rolePrompt": "default.md",
    "sessionPolicy": "ephemeral"
  },
  "participants": [
    { "id": "umsg-cto-o" },
    { "id": "umsg-exec-s" },
    { "id": "umsg-audit-s" },
    { "id": "umsg-secretary-s" }
  ]
}
```

Resolution rules:
1. If participant has explicit `"rolePrompt": "custom.md"`, load `data/prompts/custom.md`.
2. Otherwise, try `data/prompts/{role}.md` (role parsed from ID).
3. If that file doesn't exist, load `data/prompts/default.md`.
4. If `default.md` doesn't exist, use inline fallback: `"You are a helpful assistant."`.

`rolePrompt` field in JSON is now a **filename**, not inline text. This is a breaking change from spec 006 — the executor must update the loading logic.

Create initial prompt files with short stubs. User will fill in real prompts later:
- `data/prompts/default.md` — "You are a helpful assistant."
- `data/prompts/cto.md` — "You are CTO. You architect systems, write specs, and make technical decisions."
- `data/prompts/exec.md` — "You are Executor. You implement specs precisely as written."
- `data/prompts/audit.md` — "You are Auditor. You review implementations against specs and report issues."
- `data/prompts/secretary.md` — "You are Secretary. You track decisions, todos, and project state."

### D2: Participant ID Parsing Hardening (`src/participants/config.ts`)

Fix `parseParticipantId` to handle all edge cases cleanly:

| Input | Expected | Current behavior |
|-------|----------|-----------------|
| `umsg-cto-o` | project=umsg, role=cto, model=o | ✓ correct |
| `umsg-exec-s` | project=umsg, role=exec, model=s | ✓ correct |
| `umsg-cto` | project=umsg, role=cto, model=undefined | ✗ role="" model=cto (broken) |
| `myapp-o` | project=myapp, role=undefined, model=o | ✗ role=o, model=o (ambiguous) |
| `cto` | project=cto, role=undefined, model=undefined | role="" (broken) |
| `umsg-dev-ops-s` | project=umsg, role=dev-ops, model=s | ✓ correct |
| `""` | error/skip | role="" (no error) |

New return type — model and role can be `undefined`:
```typescript
parseParticipantId(id: string): { project: string; role: string | undefined; model: string | undefined }
```

Parser returns `undefined` for missing segments. `loadParticipants` applies defaults from config:
- `model ?? defaults.model` (then resolve shorthand to full model name)
- `role ?? "default"` (maps to `data/prompts/default.md` for prompt resolution)

New parsing rules:
- **3+ segments** where last is a model letter: `project-role[-role...]-model` — current behavior, works.
- **3+ segments** where last is NOT a model letter: `project-role[-role...]` — entire suffix is role, model=undefined.
- **2 segments** where last is a model letter (`umsg-o`): ambiguous. Treat as `project=first, role=undefined, model=last`. Log a warning.
- **2 segments** where last is NOT a model letter (`umsg-cto`): `project=first, role=last, model=undefined`.
- **1 segment**: `project=segment, role=undefined, model=undefined`. Log a warning.
- **Empty string**: skip participant, log error.

### D3: Full Content for All Participants (`src/umsg/handler.ts`)

Remove the summary-only routing for persistent roles. All participants get full message content as prompt.

Before (spec 006):
```typescript
if (config.sessionPolicy === "persistent") {
  prompt = `[chain:${chainId}] from:${msg.from_id} summary: ${msg.content.slice(0, 500)}`;
} else {
  prompt = msg.content;
}
```

After:
```typescript
// All participants get full message content
// Persistent roles have session context; ephemeral roles start fresh
prompt = msg.content;
```

Keep chain metadata in the log line, not in the prompt.

### D4: Test Setup + Config/Parsing Tests

Use Bun's built-in test runner (`bun test`). No extra dependencies needed.

**Package.json**: add `"test": "bun test"` to scripts.

**Test file**: `src/participants/__tests__/config.test.ts`

Test cases for `parseParticipantId`:
1. Standard 3-segment ID: `umsg-cto-o` → project=umsg, role=cto, model=o
2. Standard with sonnet: `umsg-exec-s` → project=umsg, role=exec, model=s
3. Multi-segment role: `umsg-dev-ops-s` → project=umsg, role=dev-ops, model=s
4. No model suffix: `umsg-cto` → project=umsg, role=cto, model=undefined
5. Ambiguous 2-segment with model letter: `umsg-o` → project=umsg, role=undefined, model=o
6. Single segment: `cto` → project=cto, role=undefined, model=undefined
7. Empty string: returns sensible default or throws
8. 3+ segments, no model: `umsg-dev-ops` → project=umsg, role=dev-ops, model=undefined

Test cases for `loadParticipants` (with mocked config):
1. Explicit `rolePrompt` field uses specified file
2. Missing `rolePrompt` falls back to `{role}.md`
3. Missing role file falls back to `default.md`
4. Missing `default.md` falls back to inline string
5. Model override in JSON takes precedence over ID-parsed model
6. Session policy inferred from role (cto → persistent, exec → ephemeral)
7. Explicit `sessionPolicy` in JSON overrides inference

### D5: Config Loading Update (`src/participants/config.ts`)

Update `loadParticipants` to:
1. Load role prompt from file (D1 resolution rules)
2. Use hardened parsing (D2)
3. Handle "default" role for fallback prompt resolution

New helper:
```typescript
function loadRolePrompt(rolePromptField: string | undefined, role: string): string
```

Resolution:
1. If `rolePromptField` is set → load `data/prompts/{rolePromptField}`
2. Else → try `data/prompts/{role}.md`
3. If file not found → try `data/prompts/default.md`
4. If still not found → return `"You are a helpful assistant."`

File reads are sync at startup (same as current config loading). Log which prompt file was loaded per participant: `[config] umsg-cto-o → prompts/cto.md (247 chars)`.

---

## What Changes, What Stays

| Component | Action |
|-----------|--------|
| `data/participants.json` | Update — `rolePrompt` is now a filename, not inline text. Can be omitted (auto-resolved from role). |
| `data/prompts/*.md` | New — role prompt files |
| `src/participants/config.ts` | Update — hardened parsing, file-based prompt loading |
| `src/umsg/handler.ts` | Update — remove summary routing, full content for all |
| `package.json` | Update — add test script |
| `src/participants/__tests__/config.test.ts` | New — test suite |

---

## Acceptance Criteria

1. [x] Role prompts loaded from `data/prompts/{role}.md` files, not inline JSON.
2. [x] Fallback chain works: explicit field → role file → default file → inline fallback.
3. [x] `parseParticipantId("umsg-cto")` returns role=cto, model=undefined (not role="", model=cto).
4. [x] `parseParticipantId("cto")` returns project=cto, role=undefined, model=undefined.
5. [x] `loadParticipants` applies `defaults.model` when parser returns model=undefined.
6. [x] Empty participant ID is skipped with error log.
7. [x] All participants receive full message content (no summary truncation).
8. [x] `bun test` passes with all parsing and config test cases.
9. [x] Startup logs which prompt file was loaded for each participant.
10. [x] Existing `data/participants.json` format still works (backward compat: if `rolePrompt` looks like a filename, load file; if it's inline text and no matching file exists, use it as-is).
