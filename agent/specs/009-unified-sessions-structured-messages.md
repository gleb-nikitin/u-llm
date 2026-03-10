# Spec 009: Unified Sessions & Structured Messages

## Goal
Remove ephemeral/persistent division — all roles get session management. Add structured message format with self-made summaries. Move session clear to message meta.

## Rationale
- Even "ephemeral" roles need 2-3 resumes to complete a task. Fresh-every-time wastes context.
- Saved sessions as "briefings" — prep all roles at project start, every task fork starts warm.
- LLM-generated summaries give cheap project history (hundreds of interactions in <200 lines).
- Clear-via-meta is a user/orchestrator decision, not a config property.

---

## Deliverables

| # | File(s) | What |
|---|---------|------|
| D1 | `src/participants/config.ts` | Remove `sessionPolicy` field from `ParticipantConfig`. Remove `PERSISTENT_ROLES` set. Remove `sessionPolicy` inference from `buildParticipants`. Add `projectPath: string` field to `ParticipantConfig`. Resolve from: explicit per-participant field → `defaults.projectPath` → fallback `join(import.meta.dir, "..", "..")` (u-llm project root). |
| D2 | `data/participants.json` | Remove `sessionPolicy` from `defaults`. Add `projectPath` to defaults: `"/Users/glebnikitin/work/code/u-llm"`. Participants can override per-entry. |
| D3 | `src/umsg/handler.ts` | Unified session logic: all roles use current/saved/fork/fresh. Check `msg.meta.clear` — if true, clear current session before processing. Remove all `sessionPolicy` checks. Always persist session. Format incoming message as `# Summary\n# Content`. Parse response to extract summary. Pass `config.projectPath` as `cwd` to `sdkQuery`. |
| D4 | `src/umsg/handler.ts` | `systemPrompt.append` wrapper: prepend response format instructions to role prompt. All roles get: "Respond in markdown, English. Start with `# Summary` (≤200 chars, one line) then `# Content`." |
| D5 | `src/umsg/client.ts` | Add `summary?: string` to `WriteRequest` interface. |
| D6 | `src/umsg/handler.ts` | Write response to u-msg with explicit `summary` field (parsed from LLM response). |
| D7 | `src/umsg/message-format.ts` | New util: `formatIncoming(summary, content)` → structured prompt string. `parseResponse(text)` → `{ summary, content }` with fallback (no headers → truncate first 200 chars as summary). |
| D8 | `src/routes/session.ts` | Remove `delete-current` action. Remove ephemeral participant guard. Remove `sessionPolicy` from API responses. All participants return `session` object. |
| D9 | `src/umsg/handler.ts`, `src/sdk-query.ts` | `resolveSessionOptions`: remove `sessionPolicy` param, add `clear: boolean` param. If clear → return fresh (no resume). Otherwise: current→resume, saved→fork, neither→fresh. Always `persistSession: true`. `sdkQuery`: add `cwd?: string` to `SdkQueryOptions`, use it instead of hardcoded path. Remove `import { join }` if no longer needed. |
| D10 | Tests | Update existing tests for removed sessionPolicy. Add tests for `formatIncoming`, `parseResponse`, clear-meta logic, unified session resolution. |

---

## Handler Logic (D3/D9)

```
message arrives
  → check msg.meta.clear → if true, clearCurrentSession(participantId)
  → format prompt: formatIncoming(msg.summary, msg.content)
  → resolve session: resolveSessionOptions(current, saved)
  → sdkQuery with cwd=config.projectPath, systemPrompt.append = FORMAT_INSTRUCTIONS + rolePrompt
  → parse response: parseResponse(result.text)
  → writeMessage with summary + content
  → setCurrentSession(participantId, result.sessionId)
```

## Message Format (D7)

### formatIncoming(summary, content)
```
# Summary
{summary || content.slice(0, 100)}

# Content
{content}
```

### parseResponse(text)
Try to split on `# Summary` / `# Content` headers.
- Found both → extract summary (≤200 chars), content as remainder.
- Missing headers → `{ summary: text.slice(0, 200), content: text }`.

### Format Instructions (D4)
Prepended to every role prompt in `systemPrompt.append`:
```
Respond in markdown, in English.
Always start your response with:
# Summary
A one-line summary of your response (max 200 characters).
# Content
Your full response below.
```

## API Changes (D8)

**Before:**
```json
GET /api/participants → [{ ..., "sessionPolicy": "persistent", "session": {...} | null }]
POST /api/participants/:id/session → actions: save, delete-current, delete-saved
```

**After:**
```json
GET /api/participants → [{ "id", "role", "model", "session": { "current", "saved" } }]
POST /api/participants/:id/session → actions: save, delete-saved
```

- `sessionPolicy` removed from response
- `session` always present (never null)
- `delete-current` removed (use message meta `{ clear: true }` instead)

---

## Acceptance Criteria

1. [ ] `sessionPolicy` removed from `ParticipantConfig` interface and all references
2. [ ] All roles resume/fork/fresh — no special-casing by role
3. [ ] `msg.meta.clear === true` clears current session before processing
4. [ ] Incoming messages formatted as `# Summary\n# Content` before sending to LLM
5. [ ] LLM response parsed into summary + content
6. [ ] Summary written to u-msg via explicit `summary` field in writeMessage
7. [ ] Fallback: if response has no headers, first 200 chars used as summary
8. [ ] Fallback: if incoming summary blank, first 100 chars of content used
9. [ ] Format instructions prepended to all role prompts via `systemPrompt.append`
10. [ ] `delete-current` action removed from session API
11. [ ] Ephemeral guard removed from session API
12. [ ] `GET /api/participants` returns `session` for all participants (never null)
13. [ ] All existing tests updated, new tests for message format utils and clear-meta
14. [ ] `bun test` passes
15. [ ] `projectPath` in `ParticipantConfig`, resolved from config with fallback
16. [ ] `sdkQuery` accepts `cwd` option, handler passes `config.projectPath`
17. [ ] `data/participants.json` has `projectPath` in defaults

---

## UI Contract Changes

Update `u-msg-ui/agent/inbox/`:
- `adress-api.md`: remove `sessionPolicy`, `session` always present
- `fork-api.md`: remove `delete-current` action, document clear-via-meta

## Notes
- `resolveSessionOptions` becomes a 2-param function: `(current, saved)` + optional `clear` flag
- `data/participants.json` simplifies: `defaults` has `model` + `projectPath`
- Role prompt files unchanged — format instructions are prepended at runtime
