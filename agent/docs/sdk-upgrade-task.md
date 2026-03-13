# Task: Upgrade Claude Agent SDK to latest

## Context

We use the Claude Agent SDK (Python) with our own UI to manage sessions. We have a Max $200 subscription and authenticate via CLI login. The SDK wraps the CLI as a subprocess.

We discovered our SDK was running Opus 4.5 instead of 4.6 because the bundled CLI inside our SDK package had outdated model alias tables. We temporarily fixed this with `cli_path` pointing to our system CLI. Now we need to upgrade properly.

## What / Scope

1. Run `pip show claude-agent-sdk` and report the exact current version
2. Run `claude --version` and report the system CLI version
3. Upgrade the SDK: `pip install claude-agent-sdk==0.1.48 --upgrade --break-system-packages`
4. Verify the new version with `pip show claude-agent-sdk` again
5. Run a minimal test query to confirm model resolution:

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage

async def test():
    async for msg in query(
        prompt="Reply with just: OK",
        options=ClaudeAgentOptions(
            model="opus",
            max_turns=1,
            permission_mode="bypassPermissions",
            sandbox={"enabled": False},
        ),
    ):
        if isinstance(msg, AssistantMessage):
            print(f"Model: {msg.model}")

asyncio.run(test())
```

6. Confirm `msg.model` shows `claude-opus-4-6` (not `4-5`)
7. If confirmed, remove any `cli_path` workarounds from our codebase — aliases now resolve correctly via bundled CLI
8. Report results

## Success criteria

- `pip show claude-agent-sdk` reports 0.1.48
- Test query returns `model: claude-opus-4-6`
- No `cli_path` overrides remain in codebase

## Important: things NOT to do

- Do NOT guess or assume version numbers. Always run the command and read the output.
- Do NOT confuse Python SDK versions (0.1.x on PyPI) with TypeScript SDK versions (0.2.x on npm). They are different packages.
- The latest Python SDK on PyPI as of March 2026 is **0.1.48**. There is no 0.2.x Python SDK.
- If something crashes, report the exact error. Do not speculate about causes without evidence.
