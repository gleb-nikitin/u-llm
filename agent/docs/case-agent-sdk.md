# Case: Agent SDK

Package: `@anthropic-ai/claude-agent-sdk` (TS) / `claude_agent_sdk` (Python).
Full programmatic control — the primary integration path for u-llm.

## TypeScript Basic

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "your prompt",
  options: {
    allowedTools: ["Bash", "Read", "Grep", "Glob"],
    permissionMode: "acceptEdits",
    systemPrompt: "You are a CTO agent.",
    cwd: "/path/to/project",
    model: "opus",
  },
})) {
  if ("result" in message) console.log(message.result);
}
```

## Python Basic

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="your prompt",
    options=ClaudeAgentOptions(
        allowed_tools=["Bash", "Read", "Grep", "Glob"],
        permission_mode="acceptEdits",
        system_prompt="You are a CTO agent.",
        cwd="/path/to/project",
    ),
):
    if hasattr(message, "result"):
        print(message.result)
```

## Session Management

```typescript
// Continue most recent session
for await (const msg of query({
  prompt: "follow up",
  options: { continue: true },
})) { /* ... */ }

// Resume specific session
for await (const msg of query({
  prompt: "follow up",
  options: { resume: "session-id-here" },
})) { /* ... */ }
```

## Custom MCP Tools

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const myTools = createSdkMcpServer({
  name: "my-tools",
  version: "1.0.0",
  tools: [
    tool("tool_name", "description", {
      param: z.string().describe("param description"),
    }, async (args) => ({
      content: [{ type: "text", text: "result" }],
    })),
  ],
});

for await (const msg of query({
  prompt: "use my tool",
  options: {
    mcpServers: { "my-tools": myTools },
    allowedTools: ["mcp__my-tools__tool_name"],
  },
})) { /* ... */ }
```

## Subagents (Programmatic)

```typescript
for await (const msg of query({
  prompt: "Review and fix the auth module",
  options: {
    agents: {
      "auditor": {
        description: "Security auditor",
        prompt: "You are a senior security auditor.",
        tools: ["Read", "Grep", "Glob"],
        model: "opus",
      },
      "fixer": {
        description: "Bug fixer",
        prompt: "You fix bugs precisely based on audit findings.",
        tools: ["Bash", "Read", "Write"],
        model: "sonnet",
      },
    },
  },
})) { /* ... */ }
```

## Key SDK Features

- `settingSources: ["project"]` — loads CLAUDE.md, .claude/agents/, .claude/skills/, hooks.
- `permissionMode: "bypassPermissions"` — full autonomy (controlled environments only).
- `include_partial_messages: true` — streaming partial updates.
- Hooks: pre/post tool execution callbacks.
- Plugins: custom commands, agents, skills, MCP servers bundled.

## Result Message Type

```typescript
{
  type: "result";
  subtype: "success" | "error";
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  session_id: string;
  total_cost_usd: number | null;
  result: string | null;
  usage: { [model: string]: ModelUsage } | null;
}
```

## Integration Pattern (Pattern 2)

```
Frontend → HTTP/WS → TS backend → query() → streams messages → forwards to frontend
```

- Native async iterator.
- Full tool/permission/session control.
- Custom MCP tools in-process.
- Subagent orchestration built-in.
