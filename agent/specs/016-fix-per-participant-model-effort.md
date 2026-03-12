# Spec 016: Fix Per-Participant Model/Effort Override Bug

## Problem

`buildParticipants()` in `config.ts` ignores per-participant `model` and `effort` fields from `participants.json`. All participants run with `defaultModel` (haiku) and `defaultEffort` (medium), regardless of their individual overrides.

Root cause: `RawParticipant` interface lacks `model?` and `effort?` fields, and `buildParticipants` only reads `raw.defaultModel` / `raw.defaultEffort`.

## Impact

CTO (should be opus/high) and executor (should be sonnet/high) have been running as haiku/medium since spec 011 claimed to implement this.

## Fix

1. Add `model?: string` and `effort?: string` to `RawParticipant` interface.
2. In `buildParticipants`, use `p.model ?? raw.defaultModel` and `p.effort ?? raw.defaultEffort ?? "medium"`.
3. Update tests: fix existing tests that assert default-only behavior, add tests for per-participant overrides.

## Files Changed

| File | Change |
|---|---|
| `src/participants/config.ts` | Add fields to `RawParticipant`, use per-participant values with fallback |
| `src/participants/__tests__/config.test.ts` | Update + add override tests |

## Acceptance Criteria

- [x] Per-participant `model` overrides `defaultModel`
- [x] Per-participant `effort` overrides `defaultEffort`
- [x] Missing per-participant fields fall back to defaults
- [x] Existing tests updated, new override tests pass
