# Claude Agent SDK — CLI Parity Settings Reference

> **Intent**: Configure Claude Agent SDK (Python) so that SDK-driven sessions are indistinguishable from `claude --dangerously-skip-permissions` CLI sessions. Same tools, same models, same thinking, same system prompt, same CLAUDE.md loading.

---

## 1. Authentication (Max $200 subscription, personal machine)

```bash
# CLI login first — SDK reuses the same auth token
claude login          # select "Claude account with subscription" → Max
# SDK bundles CLI internally; if CLI is authed, SDK uses that auth
# Do NOT set ANTHROPIC_API_KEY env var — it overrides subscription auth
unset ANTHROPIC_API_KEY
```

SDK picks up auth from `~/.claude/` automatically. No code-level auth config needed for personal use.

---

## 2. Model Aliases & Full Model Strings

| Alias       | Full model ID                        | Notes                                           |
|-------------|--------------------------------------|-------------------------------------------------|
| `sonnet`    | `claude-sonnet-4-6`                 | Default for Max. Fastest, 90%+ of tasks.        |
| `opus`      | `claude-opus-4-6`                   | Deep reasoning, architecture, multi-agent coord. |
| `haiku`     | `claude-haiku-4-5-20251001`         | Budget. Subagent file reads, simple tasks.       |
| `opusplan`  | hybrid: opus in plan → sonnet in exec | Best cost/quality for plan-then-execute flows.  |
| `sonnet[1m]`| `claude-sonnet-4-6` + 1M context    | Long sessions. API/PAYG only, not subscription. |
| `opus[1m]`  | `claude-opus-4-6` + 1M context      | Long sessions. API/PAYG only, not subscription. |

Pin specific versions via env vars if needed:
```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL="claude-opus-4-6"
export ANTHROPIC_DEFAULT_SONNET_MODEL="claude-sonnet-4-6"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="claude-haiku-4-5-20251001"
```

CLI default model for Max: `sonnet` (falls back from opus automatically at usage thresholds).

---

## 3. Effort Levels (Adaptive Thinking)

| Level    | Behavior                                                        | CLI equivalent          |
|----------|-----------------------------------------------------------------|-------------------------|
| `low`    | Minimal thinking, skips for simple tasks. Fast, cheap.          | `/effort low`           |
| `medium` | Balanced. Opus 4.6 default for Max/Team subscribers.            | `/effort medium`        |
| `high`   | Deep thinking, almost always thinks. Sonnet 4.6 default.        | `/effort high` (default)|
| `max`    | Always thinks, no constraints. Highest capability + cost.        | `/effort max`           |

SDK config:
```python
# Via ClaudeAgentOptions — not directly exposed yet, use env var
import os
os.environ["CLAUDE_CODE_EFFORT_LEVEL"] = "high"  # or "low", "medium", "max"

# Or in settings.json:
# { "effortLevel": "high" }
```

To disable adaptive thinking and use fixed budget:
```bash
export CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1
# Then MAX_THINKING_TOKENS controls the fixed budget
```

---

## 4. Complete Built-in Tools List

These are ALL tools available in Claude Code. With `bypassPermissions` they are all auto-approved.

### File Operations
| Tool           | Purpose                                          |
|----------------|--------------------------------------------------|
| `Read`         | Read files (text, images, PDFs, notebooks)       |
| `Write`        | Create/overwrite files                           |
| `Edit`         | Exact string replacement in files                |
| `MultiEdit`    | Batch edits across files                         |
| `NotebookRead` | Read Jupyter notebooks                           |
| `NotebookEdit` | Edit Jupyter notebook cells                      |

### Search & Navigation
| Tool    | Purpose                                            |
|---------|----------------------------------------------------|
| `Glob`  | Fast file pattern matching (sorted by mtime)       |
| `Grep`  | Content search via ripgrep (regex, filters)        |
| `LS`    | List directory contents                            |

### Execution
| Tool         | Purpose                                             |
|--------------|-----------------------------------------------------|
| `Bash`       | Execute shell commands (persistent session, 2min default timeout, 10min max) |
| `BashOutput` | Retrieve output from background bash processes      |
| `KillShell`  | Kill a running shell session                        |

### Web
| Tool        | Purpose                                              |
|-------------|------------------------------------------------------|
| `WebFetch`  | Fetch URL content with prompt-based extraction       |
| `WebSearch` | Web search (min 2 char query)                        |

### Agent & Planning
| Tool           | Purpose                                            |
|----------------|----------------------------------------------------|
| `Agent`        | Launch subagents (alias: `Task`)                   |
| `TodoRead`     | Read task list                                     |
| `TodoWrite`    | Create/update task lists                           |
| `ExitPlanMode` | Exit plan mode to execution                        |

### Interactive & Config
| Tool              | Purpose                                         |
|-------------------|-------------------------------------------------|
| `AskUserQuestion` | Ask user clarifying questions                   |
| `SlashCommand`    | Execute slash commands                          |
| `Config`          | Read/write configuration                        |

### MCP
| Tool                    | Purpose                                  |
|-------------------------|------------------------------------------|
| `ListMcpResources`      | List MCP server resources                |
| `ReadMcpResource`       | Read MCP resource                        |
| `SubscribeMcpResource`  | Subscribe to MCP resource updates        |
| `UnsubscribeMcpResource`| Unsubscribe from MCP resource            |
| `mcp__<server>__<tool>` | Any tool from connected MCP servers      |

### Subagent Types (via `Agent` tool)
| Type                | Tools Available                          |
|---------------------|------------------------------------------|
| `general-purpose`   | ALL tools                                |
| `Explore`           | Glob, Grep, Read, Bash                   |
| `statusline-setup`  | Read, Edit                               |
| `output-style-setup`| Read, Write, Edit, Glob, Grep            |

---

## 5. Core SDK Configuration — Full CLI Parity

```python
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient
import os

# ── Environment variables (set before SDK init) ──
os.environ["CLAUDE_CODE_EFFORT_LEVEL"] = "high"  # match CLI default

# ── Options that replicate `claude --dangerously-skip-permissions` ──
options = ClaudeAgentOptions(

    # ═══ PERMISSIONS: bypass all (= --dangerously-skip-permissions) ═══
    permission_mode="bypassPermissions",

    # ═══ SANDBOX: disabled (CLI has no sandbox with --dangerously-skip-permissions) ═══
    sandbox={
        "enabled": False,
    },

    # ═══ MODEL: match CLI default ═══
    model="sonnet",                    # or "opus", "haiku", "opusplan"
    # fallback_model="haiku",          # optional: auto-fallback on errors

    # ═══ TOOLS: no restriction needed ═══
    # bypassPermissions auto-approves everything
    # allowed_tools is irrelevant in this mode
    # Use disallowed_tools ONLY to hard-block specific tools:
    # disallowed_tools=["WebSearch"],  # deny rules override even bypassPermissions

    # ═══ SETTINGS SOURCES: load CLAUDE.md and .claude/settings.json ═══
    setting_sources=["project"],       # CRITICAL: without this, no CLAUDE.md loading

    # ═══ WORKING DIRECTORY ═══
    cwd="/work/your-project",          # match your CLI working directory

    # ═══ SYSTEM PROMPT: keep default (None = CLI default system prompt) ═══
    system_prompt=None,                # None = use full Claude Code system prompt
    # system_prompt="custom"           # REPLACES entire system prompt
    # append_system_prompt="extra"     # APPENDS to default system prompt (use for additions)

    # ═══ SESSION MANAGEMENT ═══
    # resume="session-id",             # resume a previous session
    # continue_conversation=True,      # continue last conversation in cwd
    # max_turns=None,                  # None = unlimited (CLI default)

    # ═══ BUDGET ═══
    # max_budget_usd=None,             # None = no limit (CLI default)

    # ═══ MCP SERVERS ═══
    mcp_servers={
        # Example: your search tool
        # "u-msg-search": {
        #     "type": "stdio",
        #     "command": "node",
        #     "args": ["/path/to/your-mcp-server/index.js"]
        # },
    },

    # ═══ ADDITIONAL DIRECTORIES (read access beyond cwd) ═══
    # add_dirs=["/work/shared-libs"],

    # ═══ HOOKS (optional, replicate CLI hooks if you have any) ═══
    # hooks={
    #     "PreToolUse": [HookMatcher(...)],
    #     "PostToolUse": [HookMatcher(...)],
    # },

    # ═══ SUBAGENTS (optional programmatic agent definitions) ═══
    # agents={
    #     "code-reviewer": {
    #         "description": "Expert code reviewer",
    #         "prompt": "You are a senior code reviewer...",
    #         "tools": ["Read", "Grep", "Glob", "Bash"],
    #         "model": "sonnet",
    #     },
    # },
)
```

---

## 6. Interactive Client (Chat UI Use Case)

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

options = ClaudeAgentOptions(
    permission_mode="bypassPermissions",
    sandbox={"enabled": False},
    model="sonnet",
    cwd="/work/your-project",
    setting_sources=["project"],
)

async with ClaudeSDKClient(options=options) as client:
    # First message
    await client.query("your prompt here")
    async for msg in client.receive_response():
        # stream to your UI
        handle_message(msg)

    # Continue conversation (same session)
    await client.query("follow-up")
    async for msg in client.receive_response():
        handle_message(msg)

    # Switch model mid-session
    await client.set_model("opus")

    # Switch permission mode mid-session
    await client.set_permission_mode("plan")  # enter plan mode
    await client.set_permission_mode("bypassPermissions")  # back to exec
```

---

## 7. Session Continuity (Resume/Fork)

```python
# Resume a previous session
options = ClaudeAgentOptions(
    resume="session-id-from-previous-run",
    permission_mode="bypassPermissions",
    sandbox={"enabled": False},
    setting_sources=["project"],
)

# Fork (branch from a session without modifying it)
options = ClaudeAgentOptions(
    resume="session-id",
    fork_session=True,  # creates new branch
    permission_mode="bypassPermissions",
    sandbox={"enabled": False},
    setting_sources=["project"],
)
```

Session logs are stored at `~/.claude/projects/` as JSONL files — same location CLI uses.

---

## 8. What `setting_sources=["project"]` Loads

When set, the SDK reads the same config hierarchy as CLI:

| Source                        | Path                          | Purpose                   |
|-------------------------------|-------------------------------|---------------------------|
| User settings                 | `~/.claude/settings.json`     | Global personal prefs     |
| User CLAUDE.md                | `~/.claude/CLAUDE.md`         | Global agent instructions |
| Project settings (shared)     | `<cwd>/.claude/settings.json` | Team defaults (git-tracked)|
| Project settings (local)      | `<cwd>/.claude/settings.local.json` | Personal project prefs |
| Project CLAUDE.md             | `<cwd>/CLAUDE.md`             | Project agent instructions|
| Project .claude/CLAUDE.md     | `<cwd>/.claude/CLAUDE.md`     | Alternative location      |

Priority: project-local > project-shared > user. Content-level rules override tool-level.

Without `setting_sources=["project"]`, **none of this loads** — the SDK runs with zero filesystem config.

---

## 9. Environment Variables Reference (CLI Parity)

```bash
# ── Model control ──
ANTHROPIC_MODEL=sonnet                          # default model
ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4-6    # pin opus version
ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-4-6 # pin sonnet version  
ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4-5-20251001

# ── Thinking control ──
CLAUDE_CODE_EFFORT_LEVEL=high                   # low|medium|high|max
CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=0         # 1 to disable, use fixed budget
MAX_THINKING_TOKENS=50000                       # only when adaptive is disabled

# ── Prompt caching ──
DISABLE_PROMPT_CACHING=0                        # 1 to disable all caching

# ── Output ──
CLAUDE_CODE_MAX_OUTPUT_TOKENS=16384             # max output tokens per response (1-32000)

# ── SDK-specific ──
CLAUDE_CODE_EXIT_AFTER_STOP_DELAY=30            # auto-exit SDK after idle (seconds)
```

---

## 10. Safety Considerations

| Setting combination | Effect | Risk |
|---|---|---|
| `bypassPermissions` alone, sandbox disabled | All tools auto-approved, no filesystem/network isolation | Full system access — intended for personal trusted use |
| `bypassPermissions` + sandbox enabled + `allowUnsandboxedCommands=True` | Model can silently escape sandbox | **Dangerous** — sandbox becomes theater |
| `bypassPermissions` + `disallowed_tools` | Deny rules still enforced | Safe way to block specific tools even in bypass mode |

For your use case (personal machine, own UI): `bypassPermissions` + `sandbox.enabled=False` is the correct match for `--dangerously-skip-permissions`.

---

## 11. SDK Version Requirements

- SDK version ≥ `0.1.40` — handles unknown message types (like `rate_limit_event` from subscription) without crashing
- SDK version ≥ `0.1.8` — bundles CLI automatically, no separate install needed
- CLI bundled version tracks SDK release; override with `cli_path="/path/to/claude"` if needed
- Package name: `claude-agent-sdk` (renamed from `claude-code-sdk`)

```bash
pip install claude-agent-sdk --break-system-packages --upgrade
```

---

## 12. Quick Checklist: CLI ↔ SDK Parity

| Feature | CLI (`--dangerously-skip-permissions`) | SDK equivalent |
|---|---|---|
| All tools approved | ✅ automatic | `permission_mode="bypassPermissions"` |
| No sandbox | ✅ automatic | `sandbox={"enabled": False}` |
| CLAUDE.md loaded | ✅ automatic | `setting_sources=["project"]` |
| Default system prompt | ✅ automatic | `system_prompt=None` (default) |
| Model selection | `--model sonnet` | `model="sonnet"` |
| Effort level | `/effort high` | `CLAUDE_CODE_EFFORT_LEVEL=high` env var or settings |
| Session resume | `--resume <id>` | `resume="<id>"` |
| MCP servers | `~/.claude/settings.json` or `--mcp-config` | `mcp_servers={...}` or via `setting_sources` |
| Max budget | `--max-budget-usd 5` | `max_budget_usd=5.0` |
| Working directory | `cd /project && claude` | `cwd="/project"` |
| Subagents | automatic | automatic (same behavior) |
| Hooks | `.claude/settings.json` hooks section | `hooks={...}` or via `setting_sources` |
