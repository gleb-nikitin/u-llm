# Spec 001: Project Skeleton + Agent SDK Basic

## Goal
Establish the TypeScript project and verify Claude connection via Agent SDK. A CLI tool that takes a prompt, sends it to Claude, and prints the response.

## Context
- Project initialized from template — context files and knowledge base are ready, no implementation yet.
- Stack decision: TypeScript + Bun runtime (aligned with u-msg-ui donor).
- Primary integration: `@anthropic-ai/claude-agent-sdk` (stable V1).
- Auth: Claude Max OAuth — `claude` CLI must be logged in on the machine. No API key.
- Reference: `./agent/docs/case-agent-sdk.md` for SDK usage patterns.
- Donor tsconfig/package conventions: `./agent/docs/arch.md` → Sibling Projects section.

## Deliverables
| File | Action |
|------|--------|
| `package.json` | Create |
| `tsconfig.json` | Create |
| `src/cli.ts` | Create |
| `src/sdk-query.ts` | Create |

## Interface

```bash
# One-shot query
bun run src/cli.ts "what is 2+2"

# With model selection
bun run src/cli.ts --model opus "review this architecture"
```

Output: assistant response text to stdout, then a status line with session_id, duration, and turns to stderr.

## Behavior
1. `cli.ts` parses args: positional prompt string, optional `--model` flag (default: `sonnet`).
2. `cli.ts` calls `sdkQuery(prompt, options)` from `sdk-query.ts`.
3. `sdk-query.ts` imports `query` from `@anthropic-ai/claude-agent-sdk`.
4. Iterates the async message stream from `query()`.
5. For each message with assistant text content, prints to stdout.
6. On `result` message, prints status line to stderr: `session_id`, `duration_ms`, `num_turns`.
7. Exits with code 0 on success, 1 on error.

## Constraints
- No HTTP server — CLI only.
- No session persistence or resume — that is Spec 003 scope.
- No streaming partial messages — that is Spec 003 scope. Print complete messages only.
- Use stable V1 SDK path, not V2 preview.
- Permission mode: `default`.
- Do not add Vite, eslint, or test framework in this spec — keep skeleton minimal.
- `cwd` option: set to process.cwd() so the SDK can find CLAUDE.md if present.

## Acceptance Criteria
- [x] 1. `bun install` succeeds with no errors.
- [x] 2. `bun run typecheck` (mapped to `tsc --noEmit`) passes with no errors.
- [x] 3. `bun run src/cli.ts "what is 2+2"` sends prompt to Claude, prints a coherent response to stdout.
- [x] 4. Status line on stderr shows session_id (non-empty string), duration_ms, and num_turns.
- [x] 5. `bun run src/cli.ts --model haiku "say hello"` uses haiku model.
- [x] 6. Running with no prompt argument prints usage and exits with code 1.
- [x] 7. No hardcoded API keys anywhere in the codebase.

## Verification

```bash
# Install
bun install

# Typecheck
bun run typecheck

# Basic run
bun run src/cli.ts "what is 2+2"

# Model flag
bun run src/cli.ts --model haiku "say hello"

# No args → usage message + exit 1
bun run src/cli.ts; echo "exit: $?"

# No API keys in source
grep -r "sk-ant\|ANTHROPIC_API_KEY" src/ && echo "FAIL: hardcoded key" || echo "OK"
```
