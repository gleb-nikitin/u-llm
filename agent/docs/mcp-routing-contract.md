# MCP Routing — Design Contract

> Purpose: enable LLM participants to route messages to other participants via an MCP tool, creating automated workflows (spec→exec→audit→commit→CTO) without human intervention.

## Problem

Today, u-llm's handler writes replies back to `msg.from_id` (the sender). Agents have no control over where their output goes next. The CTO→exec→audit loop requires manual message forwarding.

## Goal

Give agents an MCP tool — `route_message` — so they can send messages to any participant in any chain. The handler stays passive; agents actively decide routing.

## MCP Implementation Options

### Option 1: In-process SDK MCP (recommended for v1)

Use `createSdkMcpServer()` + `tool()` from the Agent SDK. The MCP server runs in the same process as u-llm. Tools call u-msg API directly via HTTP.

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const routingServer = createSdkMcpServer({
  name: "u-routing",
  version: "1.0.0",
  tools: [
    tool("route_message", "Send a message to another participant", {
      to: z.string().describe("participant ID (e.g. u-llm_audit, u-llm_cto)"),
      content: z.string().describe("message content"),
      summary: z.string().optional().describe("summary (auto-generated if omitted)"),
      response_from: z.string().optional().describe("who should respond (defaults to 'to')"),
      meta: z.record(z.unknown()).optional().describe("optional meta (e.g. {clear: true})"),
    }, async (args) => {
      // Post to u-msg chain via HTTP
      const result = await writeToChain(chainId, args);
      return { content: [{ type: "text", text: `Sent to ${args.to} (seq ${result.seq})` }] };
    }),
  ],
});
```

**Pros:**
- No separate process — runs inside u-llm
- Direct access to handler context (chain_id, participant_id)
- Type-safe, testable
- SDK manages lifecycle

**Cons:**
- Coupled to u-llm process
- Must be passed via `mcpServers` option on each `query()` call

### Option 2: Standalone HTTP MCP server

A separate HTTP MCP server (could be a Hono endpoint on u-llm itself, or a separate service).

```
POST http://u-llm.local:18180/mcp/sse   (or separate port)
```

**Pros:**
- Decoupled — any participant can use it regardless of SDK
- Can serve multiple projects

**Cons:**
- Need to pass chain context via tool args (agent must know chain_id)
- Extra infra to manage

### Option 3: u-msg native MCP

MCP server on u-msg itself. Agents talk directly to the message protocol.

**Pros:**
- u-msg is the authority on chains/messages
- Clean separation of concerns

**Cons:**
- u-msg is Go — different stack
- Adds MCP dependency to a service that doesn't have one
- Need to pass participant auth somehow

## Recommended: Option 1 for v1

In-process SDK MCP is simplest. The tool handler has access to the chain context because we control the handler that creates it.

## Key Design Questions

### 1. How does the tool know the chain_id?

The agent doesn't know which chain it's responding to — the handler does. Options:

**A. Closure capture (recommended):** Create the MCP server per-query inside the handler, capturing `chainId` in the tool handler's closure.

```typescript
// Inside handleNewMessage():
const chainId = event.chain_id;
const participantId = "u-llm_exec";

const routingServer = createSdkMcpServer({
  name: "u-routing",
  tools: [
    tool("route_message", "...", schema, async (args) => {
      // chainId and participantId captured from handler scope
      return await writeMessage(chainId, {
        content: args.content,
        summary: args.summary,
        notify: [args.to],
        response_from: args.response_from ?? args.to,
      }, participantId);
    }),
  ],
});

// Pass to sdkQuery
const result = await sdkQuery(prompt, {
  ...options,
  mcpServers: { "u-routing": routingServer },
});
```

**B. Agent passes chain_id:** Inject chain_id into the system prompt and make it a required tool arg. Agent must echo it back. Fragile — agent might hallucinate it.

**C. Global registry:** Store current chain_id per participant in a global map. Tool handler reads it. Race condition risk with concurrent messages.

### 2. Which participants can route where?

Options:
- **Open:** Any participant can route to any other. Simple. User watches the stream.
- **Allowlist per role:** Config in `participants.json` defines allowed routes. More control but more config.
- **Recommended for v1:** Open routing. User has SSE stream for oversight.

### 3. Should routing replace or supplement the current reply behavior?

Today the handler auto-writes `result.text` to the chain with `notify: [msg.from_id]`. If the agent also calls `route_message`, we'd get duplicate messages.

Options:
- **Agent takes over:** If the agent calls `route_message`, handler skips auto-reply. Agent is fully responsible.
- **Handler always replies + agent routes extra:** Agent's SDK response goes to sender (as today), plus agent can send additional routed messages.
- **Recommended for v1:** Agent takes over. If `route_message` was called during the query, handler skips the auto-write. Agent controls all output routing.

Detection: the in-process MCP handler can set a flag (`routedManually = true`) in the closure when `route_message` is called. Handler checks the flag after `sdkQuery` returns.

### 4. What about the reply content?

When an agent calls `route_message`, the content it sends IS its deliverable (e.g., audit report, implementation summary). The SDK response text (from `result.text`) may be redundant — it might just say "I've routed my response."

Options:
- **Ignore result.text if routed:** Handler treats the `route_message` call as the output.
- **Write result.text to a log:** For debugging/audit trail.
- **Recommended:** If routed manually, log `result.text` to `data/routed-replies.log` (like `discarded-replies.log`).

### 5. Loop guards

- **Max hops:** Track hop count in message meta. Each `route_message` increments. Reject above N (e.g., 10).
- **Self-routing block:** Agent can't route to itself.
- **Cost tracking:** Each hop is an SDK query (~$0.01-0.15). Log cumulative cost per workflow.
- **Recommended for v1:** Self-routing block only. Max hops is nice-to-have — user watches the stream.

### 6. Workflow tracking via state.md

When CTO creates a spec and kicks off a workflow:
1. CTO writes spec, adds `chain_id` to `state.md`
2. CTO sends first message to executor via chain
3. Executor implements, calls `route_message("u-llm_audit", ...)`
4. Auditor reviews, calls `route_message("u-llm_exec", "fix X")` or `route_message("u-llm_cto", "accepted")`
5. CTO receives acceptance, closes spec

`state.md` becomes the workflow anchor — agents read it to understand context.

## Tool Surface (v1)

```
MCP Server: u-routing
Transport: in-process SDK (type: "sdk")

Tools:
  route_message
    to: string (required) — target participant ID
    content: string (required) — message body
    summary: string (optional) — custom summary
    response_from: string (optional) — who should reply (default: to)
    meta: object (optional) — e.g. { clear: true }

Returns:
    { chain_id, seq, msg_id } — confirmation of posted message
```

## Integration Points

| Component | Change |
|-----------|--------|
| `src/umsg/handler.ts` | Create per-query MCP server with chain context in closure. Skip auto-reply if `route_message` was called. Log routed replies. |
| `src/sdk-query.ts` | Accept optional `mcpServers` override to merge with global servers. |
| `data/participants.json` | No changes for v1 (open routing). |
| `agent/docs/umsg-api.md` | Document routing tool availability. |
| System prompts | Add routing instructions to role prompts (exec: "route to audit after implementing", audit: "route to exec on reject, to CTO on accept"). |

## What This Does NOT Cover

- Multi-chain workflows (agent reads one chain, routes to another) — v2
- Dynamic participant discovery (Address Book) — separate project
- u-msg native MCP — separate project, different stack
- Debian server deployment — orthogonal
- Parallel workflows (multiple specs in flight) — requires more state management

## Dependencies

- u-msg API (`POST /api/chains/:chain_id/messages`) — exists, stable
- Agent SDK MCP support (`createSdkMcpServer`, `tool`) — exists in 0.2.74
- `writeMessage()` in `src/umsg/client.ts` — exists, used by handler

## Open Questions for Discussion

1. Should `route_message` support creating new chains (`POST /api/chains`) or only appending to the current chain?
2. Should the tool expose `list_participants` for agents to discover who's available?
3. Should agents be able to read chain history via MCP, or stick with the current CLAUDE.md `Chain_Message_ID` fetch pattern?
4. Per-participant MCP: should routing tools only be available to certain roles (CTO, exec, audit) or all participants?
