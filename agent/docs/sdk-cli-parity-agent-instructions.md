# SDK → CLI Parity: Agent Instructions

> Only what you **must explicitly set**. Everything else matches CLI automatically.

---

## Mandatory (every session)

```python
options = ClaudeAgentOptions(
    permission_mode="bypassPermissions",
    sandbox={"enabled": False},
    setting_sources=["project"],
    cwd="/work/your-project",
)
```

| Setting | Why |
|---|---|
| `permission_mode="bypassPermissions"` | SDK default is `"default"` (asks permission). CLI `--dangerously-skip-permissions` = bypass. |
| `sandbox={"enabled": False}` | Matches CLI behavior. No filesystem/network sandbox. |
| `setting_sources=["project"]` | Without this: no CLAUDE.md, no settings.json, no hooks load. CLI loads them automatically. |
| `cwd="/work/your-project"` | SDK has no implicit cwd. CLI uses shell's cwd. |

---

## Models

### Aliases (always resolve to latest version)

| Alias | Resolves to | Use for |
|---|---|---|
| `"opus"` | `claude-opus-4-6` | Deep reasoning, architecture, complex debugging |
| `"sonnet"` | `claude-sonnet-4-6` | Default workhorse. 90%+ of tasks. |
| `"haiku"` | `claude-haiku-4-5-20251001` | Fast/cheap. File reads, simple subagent tasks. |
| `"opusplan"` | opus in plan mode → sonnet in execution | Best cost/quality hybrid for plan-then-execute. |

**Yes, `model="opus"` always picks the latest Opus.** Same for `"sonnet"` and `"haiku"`. Aliases auto-update when Anthropic releases new versions.

To pin a specific version (prevent auto-update):
```python
model="claude-opus-4-6"          # pinned to exact version
model="claude-sonnet-4-6"        # pinned
model="claude-haiku-4-5-20251001" # pinned
```

### Setting the model

```python
# At init
options = ClaudeAgentOptions(model="opus")

# Mid-session (ClaudeSDKClient only)
await client.set_model("sonnet")

# With fallback
options = ClaudeAgentOptions(
    model="opus",
    fallback_model="sonnet",  # auto-fallback on errors/unavailability
)
```

### Default if not set

`model=None` → account default. For Max subscription: `sonnet`. CLI auto-falls back from opus to sonnet at usage thresholds.

---

## Thinking

### Effort (recommended — adaptive thinking)

Direct field on `ClaudeAgentOptions`. Controls how deeply Claude reasons.

| Value | Behavior | Best for |
|---|---|---|
| `"low"` | Minimal/no thinking. Fast, cheap. | File reads, simple edits, linting |
| `"medium"` | Balanced. Opus 4.6 default on Max. | General coding, routine tasks |
| `"high"` | Deep thinking, almost always thinks. Sonnet 4.6 default. | Complex debugging, multi-step tasks |
| `"max"` | Always thinks, no constraints. Highest cost. | Architecture, hard reasoning |

```python
options = ClaudeAgentOptions(
    model="opus",
    effort="high",
)
```

Supported on: **Opus 4.6, Sonnet 4.6**. Ignored on Haiku.

### Fixed thinking budget (legacy, deprecated on 4.6 models)

Use only if you need exact token control. Flat integer field, not a dict.

```python
options = ClaudeAgentOptions(
    model="sonnet",
    max_thinking_tokens=10000,  # integer, not a dict
)
```

To fully disable adaptive thinking and force fixed budget:
```python
import os
os.environ["CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING"] = "1"

options = ClaudeAgentOptions(
    model="opus",
    max_thinking_tokens=50000,
)
```

### Max output tokens

```python
options = ClaudeAgentOptions(
    max_output_tokens=16384,  # 1-32000, overrides CLAUDE_CODE_MAX_OUTPUT_TOKENS env var
)
```

Opus 4.6 supports up to 128K output via API, but SDK caps at 32000 via this field.

---

## Max Turns (safety)

Prevents runaway sessions. **Always set for automated/unattended agents.**

```python
options = ClaudeAgentOptions(
    max_turns=30,  # session stops after 30 agentic turns
)
```

When exceeded: SDK returns `ResultMessage` with `subtype="error_max_turns"`.

Pair with budget for double safety:
```python
options = ClaudeAgentOptions(
    max_turns=50,
    max_budget_usd=5.0,  # hard stop at $5 spend
)
```

`max_budget_usd` exceeded returns `subtype="error_max_budget_usd"`.

Both default to `None` (unlimited) — same as CLI.

---

## Role-Based Presets

### CTO Agent (Opus, deep thinking, plan-heavy)
```python
cto_options = ClaudeAgentOptions(
    model="opus",
    effort="high",
    max_turns=50,
    max_budget_usd=10.0,
    permission_mode="bypassPermissions",
    sandbox={"enabled": False},
    setting_sources=["project"],
    cwd="/work/project",
)
```

### Executor Agent (Sonnet, fast, high turn budget)
```python
executor_options = ClaudeAgentOptions(
    model="sonnet",
    effort="medium",
    max_turns=100,
    max_budget_usd=5.0,
    permission_mode="bypassPermissions",
    sandbox={"enabled": False},
    setting_sources=["project"],
    cwd="/work/project",
)
```

### Auditor Agent (Sonnet, read-focused, low budget)
```python
auditor_options = ClaudeAgentOptions(
    model="sonnet",
    effort="low",
    max_turns=20,
    max_budget_usd=1.0,
    permission_mode="bypassPermissions",
    sandbox={"enabled": False},
    setting_sources=["project"],
    disallowed_tools=["Write", "Edit", "MultiEdit", "Bash"],  # read-only
    cwd="/work/project",
)
```

### Quick Subagent (Haiku, minimal)
```python
subagent_options = ClaudeAgentOptions(
    model="haiku",
    effort="low",
    max_turns=10,
    max_budget_usd=0.50,
    permission_mode="bypassPermissions",
    sandbox={"enabled": False},
    setting_sources=["project"],
    cwd="/work/project",
)
```

---

## Quick Reference Table

| Field | Type | Default | Notes |
|---|---|---|---|
| `model` | `str \| None` | `None` (account default) | Alias (`"opus"`) or full ID (`"claude-opus-4-6"`) |
| `fallback_model` | `str \| None` | `None` | Fallback on primary model errors |
| `effort` | `str \| None` | `None` (model default) | `"low"`, `"medium"`, `"high"`, `"max"` |
| `max_thinking_tokens` | `int \| None` | `None` | Fixed budget. Deprecated on 4.6, use `effort`. |
| `max_output_tokens` | `int \| None` | `None` | 1–32000. Per-response output cap. |
| `max_turns` | `int \| None` | `None` (unlimited) | Safety cap on agentic turns. |
| `max_budget_usd` | `float \| None` | `None` (unlimited) | Hard spend limit per session. |
| `permission_mode` | `str \| None` | `"default"` | `"bypassPermissions"` for CLI parity. |
| `sandbox` | `dict \| None` | `{"enabled": False}` | `{"enabled": False}` for CLI parity. |
| `setting_sources` | `list \| None` | `None` (no loading) | `["project"]` to load CLAUDE.md + settings. |
| `cwd` | `str \| Path \| None` | `None` | Working directory. |
| `disallowed_tools` | `list[str]` | `[]` | Hard deny. Overrides even `bypassPermissions`. |

---

## Summary

**4 mandatory fields** for CLI parity + **3 role-specific fields** per agent:

```python
# Mandatory (same for all agents)
permission_mode="bypassPermissions"
sandbox={"enabled": False}
setting_sources=["project"]
cwd="/work/project"

# Role-specific
model="opus"       # or "sonnet", "haiku", "opusplan"
effort="high"      # or "low", "medium", "max"
max_turns=50       # safety cap, always set for unattended agents
```
