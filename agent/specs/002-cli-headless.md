# Spec 002: CLI Headless Integration

## Goal
Add a second connection method: spawn `claude` CLI as a subprocess with stream-json output. This gives us the CLI headless path alongside the Agent SDK path from Spec 001.

## Context
- Spec 001 delivered project skeleton + Agent SDK basic query.
- Reference: `./agent/docs/case-cli-headless.md` for CLI usage patterns.
- CLI headless mode uses `claude -p` with `--output-format stream-json` for JSONL output.
- Auth: same Claude Max OAuth — CLI must be logged in.

## Deliverables
| File | Action |
|------|--------|
| `src/cli-headless.ts` | Create — subprocess wrapper for `claude -p` |
| `src/cli.ts` | Modify — add `--via cli` flag to switch between SDK and CLI paths |

## Interface

```bash
# Via Agent SDK (default, from Spec 001)
bun run src/cli.ts "what is 2+2"

# Via CLI subprocess
bun run src/cli.ts --via cli "what is 2+2"

# Via CLI with model
bun run src/cli.ts --via cli --model haiku "say hello"
```

Same output contract as Spec 001: response text to stdout, status line to stderr.

## Behavior
1. `cli-headless.ts` exports `cliQuery(prompt, options)` function.
2. Spawns `claude -p "<prompt>" --output-format stream-json` as child process.
3. If `--model` specified, adds `--model <model>` flag to spawn args.
4. Reads stdout line by line, parses each line as JSON.
5. Extracts assistant text from message events, prints to stdout.
6. On `result` event, extracts `session_id`, `duration_ms`, `num_turns` and prints status to stderr.
7. Returns exit code from subprocess (0 success, non-zero error).
8. `cli.ts` updated: `--via` flag selects `sdkQuery` (default) or `cliQuery`.

## Constraints
- No session persistence or resume — that is Spec 003 scope.
- No bidirectional streaming (stream-json input mode) — keep it simple one-shot.
- No system prompt flags in this spec — keep it minimal.
- Subprocess must inherit stderr for Claude CLI's own error output.
- Do not install additional dependencies for JSONL parsing — parse line by line with `JSON.parse`.

## Acceptance Criteria
- [ ] 1. `bun run typecheck` passes with no errors.
- [ ] 2. `bun run src/cli.ts --via cli "what is 2+2"` sends prompt via CLI subprocess and prints response.
- [ ] 3. Status line on stderr shows session_id, duration_ms, num_turns (same format as Spec 001).
- [ ] 4. `bun run src/cli.ts --via cli --model haiku "say hello"` uses haiku model.
- [ ] 5. Default `--via sdk` still works (Spec 001 not broken).
- [ ] 6. No additional runtime dependencies added (uses Bun's built-in subprocess APIs).

## Verification

```bash
# Typecheck
bun run typecheck

# SDK path still works
bun run src/cli.ts "what is 2+2"

# CLI path
bun run src/cli.ts --via cli "what is 2+2"

# CLI with model
bun run src/cli.ts --via cli --model haiku "say hello"

# Verify no new deps
cat package.json | grep -c "dependencies" # should be same count as post-001
```
