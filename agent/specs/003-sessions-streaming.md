# Spec 003: Session Management + Streaming

## Goal
Add session persistence (resume conversations) and streaming partial output to both SDK and CLI paths. This completes the three Claude connection capabilities.

## Context
- Spec 001 delivered Agent SDK one-shot query.
- Spec 002 delivered CLI headless one-shot query.
- Both paths capture session_id but don't persist or reuse it.
- Reference: `./agent/docs/case-agent-sdk.md` (session management section).
- Reference: `./agent/docs/case-cli-headless.md` (multi-turn section).
- Reference: `./agent/docs/case-orchestration.md` (session reuse patterns).

## Deliverables
| File | Action |
|------|--------|
| `src/session-store.ts` | Create — persist and retrieve session IDs |
| `src/sdk-query.ts` | Modify — add resume option, streaming partial output |
| `src/cli-headless.ts` | Modify — add resume option |
| `src/cli.ts` | Modify — add `--resume`, `--continue`, `--stream` flags |

## Interface

```bash
# New session (prints session_id in status)
bun run src/cli.ts "start a code review"

# Resume session by ID
bun run src/cli.ts --resume abc123 "now check the tests"

# Continue most recent session
bun run src/cli.ts --continue "what about error handling?"

# Streaming output (tokens appear as they arrive)
bun run src/cli.ts --stream "explain async iterators in detail"

# Combined
bun run src/cli.ts --continue --stream "elaborate on that"

# List saved sessions
bun run src/cli.ts --sessions
```

## Behavior

### Session Store
1. `session-store.ts` persists sessions as JSON file at `./data/sessions.json`.
2. Each entry: `{ session_id, created_at, last_used_at, prompt_preview }`.
3. On query completion, upsert session record.
4. `--sessions` flag lists stored sessions (id, last_used, preview).
5. `--continue` resolves to the most recently used session_id.

### SDK Resume
1. `sdkQuery` accepts optional `resume` option.
2. If `resume` provided, passes `{ resume: session_id }` to `query()` options.
3. If `continue` provided, resolves latest session_id from store, then resumes.

### CLI Resume
1. `cliQuery` accepts optional `resume` option.
2. If resume provided, adds `--resume <session_id>` to spawn args.
3. If continue, adds `--continue` flag.

### Streaming
1. `--stream` flag enables partial message output.
2. SDK path: enables `include_partial_messages: true` in query options, prints text deltas as they arrive (no newline until complete).
3. CLI path: already streams via `--output-format stream-json` — extract and print text deltas from assistant message events incrementally.

## Constraints
- Session store is a simple JSON file, not a database. Adequate for MVP.
- `./data/` directory should be gitignored.
- No `forkSession` in this spec — that is a later enhancement.
- No system prompt customization in this spec.
- Streaming prints partial text inline (overwrite-style or append-style — implementer's choice as long as final output matches non-streaming).

## Acceptance Criteria
- [ ] 1. `bun run typecheck` passes.
- [ ] 2. `bun run src/cli.ts "hello"` creates a session entry in `./data/sessions.json`.
- [ ] 3. `bun run src/cli.ts --resume <id> "follow up"` continues the previous conversation.
- [ ] 4. `bun run src/cli.ts --continue "next question"` resumes the most recent session.
- [ ] 5. `bun run src/cli.ts --sessions` lists stored sessions with id, last_used, preview.
- [ ] 6. `bun run src/cli.ts --stream "explain closures"` shows text appearing incrementally.
- [ ] 7. `bun run src/cli.ts --via cli --resume <id> "follow up"` works via CLI subprocess path.
- [ ] 8. `./data/` is in `.gitignore`.

## Verification

```bash
# Typecheck
bun run typecheck

# Create session
bun run src/cli.ts "hello, remember my name is Gleb"

# Check session file
cat ./data/sessions.json

# Resume
SID=$(cat ./data/sessions.json | bun -e "const d=JSON.parse(await Bun.stdin.text()); console.log(d[d.length-1].session_id)")
bun run src/cli.ts --resume "$SID" "what is my name?"

# Continue
bun run src/cli.ts --continue "say it again"

# List sessions
bun run src/cli.ts --sessions

# Streaming
bun run src/cli.ts --stream "count from 1 to 20 slowly"

# CLI path resume
bun run src/cli.ts --via cli --continue "one more time"

# Gitignore check
grep "data/" .gitignore && echo "OK" || echo "FAIL: data/ not gitignored"
```
