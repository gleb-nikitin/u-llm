# Case: CLI Headless Mode

Claude Code CLI as subprocess — simplest integration path. Good for quick start, scripting, and Pattern 1 architecture.

## One-Shot

```bash
claude -p "prompt" --output-format json
```

## Streaming

```bash
claude -p "prompt" --output-format stream-json
```

Stream-JSON emits: `init` → interleaved user/assistant messages → `result`.

## Multi-Turn (Session Persistence)

```bash
# Start session, capture ID
sid=$(claude -p "initial prompt" --output-format json | jq -r '.session_id')

# Continue same session
claude -p --resume "$sid" "follow up"

# Continue most recent session in cwd
claude --continue --print "next prompt"
```

## System Prompt Control

```bash
# Append to built-in system prompt (recommended)
claude -p "prompt" --append-system-prompt "You are a security auditor."

# Replace entire system prompt
claude -p "prompt" --system-prompt "Full custom system prompt."

# From file
claude -p "prompt" --append-system-prompt-file ./agent-prompt.md
```

## Tool/Permission Control

```bash
claude -p "prompt" \
  --allowedTools "Bash,Read,Grep,Glob" \
  --permission-mode acceptEdits \
  --cwd /path/to/project
```

Permission modes: `default` | `acceptEdits` | `bypassPermissions` | `plan`

## Subagents via CLI

```bash
claude --agents '{
  "auditor": {
    "description": "Code auditor for security and quality review.",
    "prompt": "You are a senior auditor. Focus on correctness and security.",
    "tools": ["Read", "Grep", "Glob"],
    "model": "opus"
  },
  "executor": {
    "description": "Implementation agent.",
    "prompt": "You implement specs precisely. Write clean, tested code.",
    "tools": ["Bash", "Read", "Write", "Grep", "Glob"],
    "model": "sonnet"
  }
}'
```

## Bidirectional Streaming (Multi-Turn Without Relaunch)

```bash
echo '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"your prompt"}]}}' \
  | claude -p --output-format=stream-json --input-format=stream-json
```

Format: JSONL — each input line is a complete JSON object.

## Output Schema (JSON Mode)

```json
{
  "type": "result",
  "subtype": "success",
  "total_cost_usd": 0.003,
  "is_error": false,
  "duration_ms": 1234,
  "duration_api_ms": 800,
  "num_turns": 6,
  "result": "response text",
  "session_id": "abc123"
}
```

## Session Storage

Path: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`
`<encoded-cwd>` = absolute path with non-alphanumeric chars replaced by `-`.

## Integration Pattern (Pattern 1)

```
Frontend → HTTP/WS → TS backend → spawns `claude -p` subprocess → parses JSONL → streams to frontend
```

- Use `child_process.spawn` with `--output-format stream-json`.
- Parse JSONL lines from stdout.
- Track `session_id` for conversation continuity.
