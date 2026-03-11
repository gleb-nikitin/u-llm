# Spec 011 — Per-Participant Model & Effort Overrides

## Goal
Enable per-participant overrides of model and effort, allowing different roles to use different LLM capabilities without coupling identity to choice.

## Motivation
- Spec 010 established `defaultModel` and `defaultEffort` as cluster-wide defaults
- Some roles need different capabilities: exec/cto require Sonnet/Opus, audit/secretary use Haiku
- Per-participant overrides provide fine-grained control without creating new participant IDs
- Model and effort are runtime configuration, not identity — they should be independently overridable
- Implementation already supports it; this spec formalizes the feature

## Config Shape Change
```json
{
  "defaultModel": "claude-haiku-4-5-20251001",
  "defaultEffort": "medium",
  "participants": [
    {
      "id": "u-llm_cto",
      "project": "u-llm",
      "role": "cto",
      "model": "claude-opus-4-5-20251101",
      "effort": "high",
      "projectPath": "/path"
    }
  ]
}
```

## Implementation Changes

### D1: participants.json
Configure roles with overrides:
- `u-llm_cto`: Opus 4.5 + high effort
- `u-llm_exec`: Sonnet + high effort
- `u-llm_audit`, `u-llm_secretary`: use defaults

### D2: config.ts
Already implemented:
- `RawParticipant` includes optional `model?` and `effort?` fields
- `buildParticipants` applies per-participant overrides
- Priority: per-participant > default

### D3: routes/session.ts
API response format per spec 010: `{id, role, project, session}` — no model/effort

### D4: Tests
7 new tests added to cover override scenarios:
- Model override only
- Effort override only
- Both model & effort override
- Mixed participants (some override, some default)
- Per-participant without effort (uses default)
- Per-participant without model (uses default)

## Acceptance Criteria
- [x] 1. `participants.json` configured with per-participant overrides for cto/exec
- [x] 2. `RawParticipant` supports optional model/effort fields
- [x] 3. `buildParticipants` applies priority correctly
- [x] 4. All tests pass (46/46)
- [x] 5. API response follows spec 010 (no model/effort exposed)
- [x] 6. Documentation updated in kb.md
