# Spec 021: Handoff Routing + send_message Dedup (ad-hoc)

## Problem
1. Handler hardcoded `notify: [msg.from_id]` on every reply — agents couldn't control who receives their response.
2. Agents using `send_message` MCP tool to post directly to chains caused duplicate messages — handler auto-captured `result.text` as a second message.
3. `parseResponse` didn't extract `# Handoff` section from agent responses.
4. Format instructions were heavy (Aurora Core mission doc) — should be minimal.
5. Watchdog only monitored u-llm project sessions, missing other projects (u-au, u-msg-ui).

## Changes

### Message format parser (`src/umsg/message-format.ts`)
- `parseResponse` now extracts `# Handoff` section (first word, lowercased) from agent responses
- Returns `{ summary, content, handoff? }` — handoff is optional
- Handles responses without `# Content` marker — everything before `# Summary` becomes content
- `# Handoff` is always last, stripped before content/summary parsing

### Handler routing (`src/umsg/handler.ts`)
- Handoff resolution: if `parsed.handoff` is set, looks up `role === handoff` in same project's participants → sets `notify` and `response_from` to that participant
- Falls back to `notify: [msg.from_id]` when no handoff or role not found
- Stores `handoff` in message `meta` field

### send_message dedup (`src/umsg/handler.ts`)
- `onEvent` callback now always set (not just when streaming enabled)
- Tracks `agentPostedToChain` flag — set when `tool_use` event for `send_message` detected
- After SDK call: if agent posted to chain directly, handler skips `writeMessage` auto-capture
- Eliminates duplicate messages, ghost posts, and garbage summaries from Path B agents

### Format instructions (`data/prompts/format.md`)
- Reduced from 38-line Aurora Core mission doc to 2 lines: `Respond in markdown, LLM efficient. Backend: LLM-first. Frontend: human-first.`
- Role-specific format (Content/Summary/Handoff) now delivered via briefing sessions, not system prompt

### Participants config (`data/participants.json`)
- Added 6 u-au participants: coo, cto, find (opus, high effort), git, audit, exec (sonnet, high effort)

### Watchdog (`scripts/watchdog.sh`)
- Now resolves `projectPath` per participant from `participants.json`
- Encodes each participant's project path to find correct Claude session directory
- Monitors sessions across all projects (u-llm, u-au, u-msg-ui, etc.)

### CLAUDE.md
- Simplified to entry point only — removed service URLs, chain access patterns (now in briefing sessions)

### Intent updates (`agent/roadmap/intent.md`)
- Added "Chains as Documentation" phase — chains replace static markdown docs
- Added "Agent Reply Format & Auto-Routing" phase — handoff-based orchestration loop
- Updated direction rules: conversations are documentation, repo contains code only

## Tests
- `parseResponse` handoff extraction: with/without handoff, lowercasing, first-word-only, no `# Content` marker
- FORMAT_INSTRUCTIONS: updated assertions for new minimal content
- All existing tests preserved
- 72 tests passing

## Acceptance Criteria
- [x] AC1: `parseResponse` extracts `# Handoff` as first word, lowercased
- [x] AC2: Handler resolves handoff role → participant ID in same project
- [x] AC3: Handler stores handoff in message meta
- [x] AC4: Agent using send_message → handler skips auto-capture (no duplicates)
- [x] AC5: Agent NOT using send_message → handler writes as before (no regression)
- [x] AC6: Watchdog monitors sessions across all project paths
- [x] AC7: format.md reduced to minimal directives
- [x] AC8: u-au participants configured (6 roles)
- [x] AC9: 72 tests pass
