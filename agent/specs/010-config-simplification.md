# Spec 010 — Config Simplification

## Goal
Simplify participant identity and model resolution. Strip model from participant ID, make IDs human-readable, centralize model and effort defaults.

## Motivation
- Current IDs like `umsg-cto-o` encode model as suffix — couples identity to model choice
- Model should be a runtime default, later overridable via message meta — not baked into identity
- Project names with dashes (e.g. `u-msg`) cause parsing ambiguity in `parseParticipantId`
- The 3-segment heuristic in `parseParticipantId` is fragile (documented gotcha for 2-segment IDs) and unnecessary once fields are explicit
- `MODEL_MAP` is an indirection layer with no remaining value — config should use full SDK model strings directly

## New ID Convention
- Format: `{project-name}_{role}` — underscore is the sole separator between project and role
- Project name keeps its natural form (dashes allowed): `u-msg`, `my-app`
- Examples: `u-msg_cto`, `u-msg_exec`, `my-app_audit`
- Parse rule (if ever needed): split on last underscore → `[project, role]`
- In practice, project and role come from explicit config fields — ID is an opaque key for lookups

## Config Shape Change

### Before
```json
{
  "defaults": { "model": "o", "projectPath": "/path" },
  "participants": [
    { "id": "umsg-cto-o" }
  ]
}
```

### After
```json
{
  "defaultModel": "claude-haiku-4-5-20251001",
  "defaultEffort": "medium",
  "participants": [
    {
      "id": "u-msg_cto",
      "project": "u-msg",
      "role": "cto",
      "projectPath": "/Users/glebnikitin/work/code/u-llm"
    }
  ]
}
```

### Key changes
- `defaults` object → flat top-level fields: `defaultModel`, `defaultEffort`
- `defaults.model` (single letter `"o"`) → `defaultModel` (full SDK model string)
- New `defaultEffort`: `"low"` | `"medium"` | `"high"` | `"max"` — maps directly to SDK `effort` option (controls reasoning depth, not thinking tokens)
- `project` and `role` are explicit fields per participant — no longer parsed from ID
- `MODEL_MAP`, `MODEL_LETTERS`, `parseParticipantId()` removed
- `modelShort` field removed from `ParticipantConfig`
- No per-participant `model` field — all participants use `defaultModel` (per-participant override deferred to future spec)

## Deliverables

### D1: participants.json
Update config file to new shape. Current participants:
- `u-msg_cto` (project: u-msg, role: cto)
- `u-msg_exec` (project: u-msg, role: exec)
- `u-msg_audit` (project: u-msg, role: audit)
- `u-msg_secretary` (project: u-msg, role: secretary)

All share `projectPath: "/Users/glebnikitin/work/code/u-llm"`.

### D2: config.ts
- New `RawConfig` interface:
  ```typescript
  interface RawConfig {
    defaultModel: string;
    defaultEffort?: string;
    participants: RawParticipant[];
  }
  ```
- New `RawParticipant`:
  ```typescript
  interface RawParticipant {
    id: string;
    project: string;
    role: string;
    projectPath?: string;
    rolePrompt?: string;
  }
  ```
- `ParticipantConfig` changes:
  - Drop `modelShort`
  - Add `project: string`
  - Add `effort: string` (from `defaultEffort`)
  - Keep `model` (from `defaultModel`), `role`, `rolePrompt`, `projectPath`, `id`
- Remove: `MODEL_MAP`, `MODEL_LETTERS`, `resolveModel()`, `parseParticipantId()`
- `buildParticipants`: model from `raw.defaultModel`, effort from `raw.defaultEffort ?? "medium"`, project/role from explicit fields
- `DEFAULT_CONFIG` updated to new shape with `defaultModel: "claude-haiku-4-5-20251001"`, `defaultEffort: "medium"`

### D3: sdk-query.ts
- Add `effort?: string` to `SdkQueryOptions`
- Pass `effort` to SDK query options (SDK option name: `effort` — see `how-to-sdk-claude.md` lines 176-180)

### D4: handler.ts
- Pass `config.effort` to sdkQuery alongside model
- No other changes (model/cwd/session logic stays)

### D5: routes/session.ts
- `GET /api/participants` response: `{ id, role, project, session }` — no `model` field
- Drop `modelShort` reference

### D6: Tests
- Remove `parseParticipantId` tests (function removed)
- Update `buildParticipants` tests: fixture uses new shape, assertions check explicit project/role/effort
- Update session-store route tests: fixture uses new shape, assertions match new API response (no model)
- All existing tests adapted, none removed without replacement

### D7: Documentation
- Update `u-msg-ui/agent/inbox/address-api.md` with new response shape (if file exists)
- Update `kb.md`: new ID convention, remove `parseParticipantId` mention, update config description

## Acceptance Criteria
- [x] 1. `participants.json` uses new shape with explicit project, role, defaultModel, defaultEffort
- [x] 2. `parseParticipantId` function removed — no ID parsing heuristics
- [x] 3. `MODEL_MAP` and `MODEL_LETTERS` removed — config uses full model strings
- [x] 4. `modelShort` removed from `ParticipantConfig` and API response
- [x] 5. `GET /api/participants` returns `{ id, role, project, session }` per entry
- [x] 6. `sdkQuery` accepts and passes `effort` option to SDK
- [x] 7. Handler passes effort from config to sdkQuery
- [x] 8. All tests pass (47/47)
- [x] 9. Default model is `claude-haiku-4-5-20251001`, default effort is `"medium"`
- [x] 10. Prompt file lookup uses explicit `role` field, not parsed from ID

## Out of Scope
- Per-participant model override (future spec — needed when roles need different models)
- Model/effort override via message meta (future)
- `maxThinkingTokens` config (different SDK option from effort — separate concern)
- Auto-population of contacts from project list (future)
- Any session logic changes (done in spec 009)
