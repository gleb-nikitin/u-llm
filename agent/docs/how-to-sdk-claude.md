# Claude Agent SDK — Session Mechanics

Reference for `@anthropic-ai/claude-agent-sdk` session lifecycle.
Our installed version: **v0.1.77**.
Sources: official docs (platform.claude.com), SDK type definitions (`runtimeTypes.d.ts`, `coreTypes.d.ts`), `agent-sdk--sessions.md`, `agent-sdk--agent-loop` page.

---

## 1. Session Resume

Pass `resume: sessionId` in `Options`. The SDK loads full conversation history from disk and replays it as input tokens.

```typescript
query({ prompt: "Continue", options: { resume: sessionId } })
```

- **Cost:** All prior messages become input tokens on every turn. However, **prompt caching is automatic** — system prompt, tool definitions, and CLAUDE.md stay the same across turns and are cached (cache reads at 0.1x base input price). Conversation history prefix that hasn't changed is also cached. Net effect: only new/changed content pays full input price.
- **Fork:** `forkSession: true` creates a new session ID branching from the resume point. Original preserved. Default `false` appends to original.
- **Partial resume:** `resumeSessionAt: messageUUID` resumes up to a specific assistant message, trimming later messages.
- **Continue latest:** `continue: true` resumes the most recent conversation by last-modified. Mutually exclusive with `resume`.

### Options Mutability on Resume

**All options can change on resume.** When resuming, you pass a full `Options` object. You CAN change:
- `allowedTools` / `disallowedTools` — switch from read-only to read-write between phases
- `permissionMode` — escalate or restrict permissions
- `systemPrompt` — change role/persona
- `model` — switch models mid-conversation
- `maxTurns`, `maxBudgetUsd` — adjust limits
- `mcpServers`, `agents` — add/remove capabilities

This is the key mechanism for multi-role session management: same session_id, different options per query.

## 2. Session Creation

Omit `resume` → new session created automatically. Session ID arrives in the first message:

```typescript
if (message.type === 'system' && message.subtype === 'init') {
  sessionId = message.session_id;
}
```

No explicit "force new" flag needed. `/clear` slash command also clears history and starts a fresh session (new `session_id`).

V2 API (unstable): `unstable_v2_createSession(opts)` / `unstable_v2_resumeSession(id, opts)`.

## 3. Session Limits

| Option | Type | Behavior on limit |
|--------|------|-------------------|
| `maxTurns` | `number` | Result with `subtype: 'error_max_turns'` |
| `maxBudgetUsd` | `number` | Result with `subtype: 'error_max_budget_usd'` |

**Context window:** When context approaches its limit, **auto-compaction** triggers — summarizes older messages to free space. Signaled by `SDKCompactBoundaryMessage`:

```typescript
{ type: 'system', subtype: 'compact_boundary', compact_metadata: { trigger: 'auto', pre_tokens: number } }
```

No hard error — automatic truncation via summarization. Specific instructions from early in the conversation may be lost during compaction. Put persistent rules in CLAUDE.md (re-injected on every request), not in the initial prompt.

You can customize compaction:
- Add a "Summary instructions" section in CLAUDE.md telling the compactor what to preserve
- Use `PreCompact` hook to archive full transcript before summarization
- Manual compaction: send `/compact` as prompt

**1M context beta:** `betas: ['context-1m-2025-08-07']` (Sonnet 4/4.5 only).

## 4. Session Clear / Reset

No API to clear history while keeping the same session_id.

| Method | Effect |
|--------|--------|
| `/clear` command | Clears all history, creates NEW session (new `session_id`) |
| `/compact` command | Summarizes history, keeps same `session_id` |
| Omit `resume` | Fresh session with new ID |

`persistSession: false` prevents disk persistence entirely — sessions cannot be resumed later. Useful for ephemeral workflows.

## 5. Concurrent Sessions

No documented limit on concurrent sessions. Each `query()` spawns a separate CLI process. Sessions are independent.

Real constraints:
- API rate limits (RPM/TPM) are shared across all sessions under one auth
- Each session = one child process (resource cost)
- No documented per-account session-count limit

## 6. Session Expiry

**Not documented.** Sessions persist as files on disk indefinitely.

Unknown: error behavior when resuming a deleted or corrupted session transcript.

## 7. System Prompt Per Session

Set via `systemPrompt` in `Options` on each `query()` call. **Can change on resume.**

```typescript
// Custom string — complete replacement (minimal, no built-in tools guidance)
systemPrompt: "You are a security auditor."

// Preset with append — Claude Code defaults + your additions
systemPrompt: { type: 'preset', preset: 'claude_code', append: 'Focus on security.' }

// Preset only — full Claude Code prompt
systemPrompt: { type: 'preset', preset: 'claude_code' }
```

**Default SDK system prompt is minimal** (tool instructions only). Must opt in to `claude_code` preset for full Claude Code behavior.

To load `CLAUDE.md` files, must also set `settingSources: ['project']`.

## 8. Model Selection Per Session

Set via `model` in `Options`. Different sessions can use different models. Can change on resume.

```typescript
query({ prompt: "...", options: { model: 'claude-sonnet-4-5', resume: sessionId } })
```

Mid-session change (streaming input mode only): `query.setModel('claude-haiku-4-5-20251001')`.

Fallback: `fallbackModel` option for automatic fallback if primary model fails.

Subagents: `model: 'sonnet' | 'opus' | 'haiku' | 'inherit'` in `AgentDefinition`.

---

## Session Storage Internals

**Location:** `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`

**Structure:**
- `sessions-index.json` — index of all sessions with metadata (sessionId, fullPath, firstPrompt, summary, messageCount, timestamps)
- `{session_id}.jsonl` — individual session transcript (JSONL format, one message per line)
- `{session_id}/subagents/agent-*.jsonl` — subagent transcripts

**Programmatic access:** Docs mention `listSessions()` and `getSessionMessages()` exports, but these are **NOT available in our SDK v0.1.77**. May be in a newer version. For now, can parse JSONL files directly if needed.

**`encoded-cwd`:** Derived from working directory. Each project directory gets its own session namespace.

## Prompt Caching on Resume

The SDK automatically uses prompt caching. No configuration needed.

**What gets cached (stays same across turns):**
- System prompt
- Tool definitions
- CLAUDE.md content

**Cache pricing:**
- Cache write: 1.25x base input price (5-min TTL) or 2x (1-hour TTL)
- Cache read: 0.1x base input price
- Standard input: 1x base price

**Implication for resume:** The system prompt + tool definitions prefix is cached. The conversation history prefix that hasn't changed between turns is also cached. Only new tokens pay full input price.

**Usage tracking fields:**
- `cache_creation_input_tokens` — tokens used to create new cache entries
- `cache_read_input_tokens` — tokens read from existing cache entries

## Context Window Management

| Source | When loaded | Impact |
|--------|-------------|--------|
| System prompt | Every request | Small fixed cost, always present |
| CLAUDE.md | Session start (if `settingSources` set) | Full content every request (prompt-cached) |
| Tool definitions | Every request | Each tool adds schema; use ToolSearch for on-demand loading |
| Conversation history | Accumulates | Grows with each turn |

**Subagents start fresh:** Each subagent gets a clean conversation (no parent history). Only its final response returns to parent as a tool result. Useful for offloading work without bloating main context.

**Effort option:** Controls reasoning depth per turn.
- `'low'` — minimal reasoning, fast (file lookups)
- `'medium'` — balanced
- `'high'` — thorough (default in TS SDK)
- `'max'` — maximum reasoning depth

## Interrupt / Abort

```typescript
// AbortController
const ac = new AbortController();
const q = query({ prompt: "...", options: { abortController: ac } });
// Later:
ac.abort();

// Or via Query interface (streaming input mode):
await q.interrupt();
```

## Key Options Reference (from runtimeTypes.d.ts)

```typescript
type Options = {
  // Session
  resume?: string;              // Session ID to resume
  resumeSessionAt?: string;     // Resume up to specific message UUID
  continue?: boolean;           // Resume most recent conversation
  forkSession?: boolean;        // Fork on resume (new ID, preserve original)
  persistSession?: boolean;     // Default true. False = ephemeral

  // Model
  model?: string;               // Model identifier
  fallbackModel?: string;       // Fallback model
  maxThinkingTokens?: number;   // Limit thinking tokens

  // Limits
  maxTurns?: number;            // Max conversation turns
  maxBudgetUsd?: number;        // Max spend in USD

  // System prompt
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string };

  // Permissions
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
  allowedTools?: string[];      // Auto-allowed tools
  disallowedTools?: string[];   // Blocked tools
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };
  canUseTool?: CanUseTool;      // Custom permission handler

  // Config sources
  settingSources?: ('user' | 'project' | 'local')[];
  betas?: SdkBeta[];            // e.g. 'context-1m-2025-08-07'

  // Extensions
  agents?: Record<string, AgentDefinition>;
  mcpServers?: Record<string, McpServerConfig>;
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  plugins?: SdkPluginConfig[];

  // Runtime
  cwd?: string;
  env?: Record<string, string | undefined>;
  abortController?: AbortController;
  includePartialMessages?: boolean;
  enableFileCheckpointing?: boolean;

  // Output
  outputFormat?: OutputFormat;   // JSON schema for structured output
  sandbox?: SandboxSettings;
}
```

## Result Message Subtypes

```typescript
// Success
subtype: 'success'                           // result field available

// Errors (no result field)
subtype: 'error_during_execution'            // API failure, cancelled request
subtype: 'error_max_turns'                   // maxTurns hit
subtype: 'error_max_budget_usd'              // maxBudgetUsd hit
subtype: 'error_max_structured_output_retries' // structured output validation failed
```

All result subtypes carry: `total_cost_usd`, `usage`, `num_turns`, `session_id`.

## Hook Events (for session lifecycle)

```typescript
'SessionStart'   // source: 'startup' | 'resume' | 'clear' | 'compact'
'SessionEnd'     // reason: ExitReason
'PreCompact'     // trigger: 'manual' | 'auto'
'Stop'           // final cleanup
```

## Design Implications for Multi-Role Session Management

1. **Role switching = same session, different options.** Resume with changed `systemPrompt`, `allowedTools`, `permissionMode` per role.
2. **No clear-in-place.** Cannot reset history while keeping ID. Either fork or create new.
3. **Auto-compaction may lose early instructions.** Put role-critical rules in CLAUDE.md or system prompt (re-injected every request), not in conversation history.
4. **Prompt caching reduces resume cost.** Static prefix (system prompt + tools) is cheap on resume. Variable part (conversation history) grows linearly.
5. **Subagents for isolation.** Use subagents when a role needs clean context without prior conversation pollution.
6. **`persistSession: false` for fire-and-forget.** Ephemeral roles that don't need resume.
7. **`forkSession: true` for branching.** Try different approaches from same checkpoint.
8. **`listSessions`/`getSessionMessages` not in v0.1.77.** For session introspection, parse JSONL directly or upgrade SDK.

---

## Implementation Approach: Session Management for u-llm

### The Problem

u-msg chains map to Claude sessions. Some chains are one-off (fresh), some are long-lived (persistent). We need to:
- Decide fresh vs persistent per chain
- Track context usage and compact before we hit the wall
- Not burn tokens on stale sessions that should have been discarded

### Session Lifecycle Model

```
chain created → policy assigned → session created → messages flow → [compact?] → [expire?] → session closed
```

Three session policies per chain:

| Policy | `resume` | `persistSession` | Use case |
|--------|----------|-------------------|----------|
| **ephemeral** | never | `false` | One-shot queries, quick lookups. New session per message. Cheapest. |
| **conversational** | always | `true` | Multi-turn dialogue. Chain = one continuous session. Default. |
| **scoped** | until reset | `true` | Long-lived chain but context gets stale. Periodic fresh starts. |

Policy can be set by the UI per chain (metadata on chain creation) or inferred (e.g., chains with a single participant default to ephemeral).

### Session Store Design

Extend our existing flat-JSON session store:

```typescript
interface SessionEntry {
  chainId: string;
  sessionId: string;         // from SDK init message
  policy: 'ephemeral' | 'conversational' | 'scoped';
  model: string;
  createdAt: number;
  lastActivityAt: number;
  // Context tracking
  totalInputTokens: number;  // cumulative from usage
  totalOutputTokens: number;
  cacheReadTokens: number;
  lastPreCompactTokens: number | null;  // from compact_boundary
  compactionCount: number;
  turnCount: number;
  totalCostUsd: number;
}
```

Updated on every `ResultMessage` (carries `usage`, `num_turns`, `total_cost_usd`, `session_id`).

### Context Tracking & Compaction Strategy

**What the SDK gives us:**
- `ResultMessage.usage` — input/output/cache tokens per query
- `compact_boundary.compact_metadata.pre_tokens` — token count right before auto-compaction
- Auto-compaction fires when context approaches the model's window limit

**Strategy: rely on SDK auto-compaction, monitor don't intervene.**

Reasoning:
- The SDK already compacts automatically at the right threshold
- Manual `/compact` risks losing context we still need
- We lack a "how full is my context?" API — we'd have to estimate from cumulative usage, which is unreliable after compaction resets the count
- The SDK's compactor reads CLAUDE.md for preservation instructions — we should use that

**What we track (for the UI and for policy decisions):**
- `turnCount` — when a conversational session exceeds N turns (e.g., 50), suggest fresh start in UI
- `compactionCount` — if auto-compaction has fired 3+ times, the session is very long; consider scoped reset
- `totalCostUsd` — budget guard per chain

**When to force a fresh session (scoped policy):**
- `compactionCount >= 3` — context has been summarized multiple times, quality degrades
- `lastActivityAt` older than 24h — stale context, model may hallucinate about current state
- User explicitly requests it from UI

### Mapping Flow

```
u-msg WS event (chain_id) arrives
  → look up SessionEntry by chain_id
  → if not found OR policy says fresh:
      create new session (omit resume, capture session_id from init message)
      store SessionEntry
  → if found AND policy says resume:
      pass resume: entry.sessionId
      on ResultMessage: update entry with usage/cost/turns
      on compact_boundary: increment compactionCount, store pre_tokens
  → if scoped AND reset condition met:
      discard old entry, create new session
```

### System Prompt Strategy

Don't put chain-specific instructions in the conversation. Put them where they survive compaction:

1. **`systemPrompt` with append** — role/persona per chain, re-injected every request
2. **CLAUDE.md via `settingSources: ['project']`** — project-wide rules (code style, tools, safety)
3. **Conversation** — only the actual user messages

```typescript
const options = {
  resume: entry?.sessionId,
  model: chain.model ?? 'sonnet',
  systemPrompt: {
    type: 'preset' as const,
    preset: 'claude_code' as const,
    append: chain.systemPromptAppend ?? '',  // per-chain role instructions
  },
  maxTurns: 30,
  maxBudgetUsd: chain.budgetUsd ?? 1.0,
  permissionMode: 'bypassPermissions',
};
```

### What NOT to Build

- **Custom compaction logic.** The SDK handles it. We just monitor.
- **Session garbage collection.** Disk files at `~/.claude/projects/` are small. Let them accumulate. If we ever need cleanup, it's a simple cron on file age.
- **Token counting pre-flight.** No reliable API for "how full is context right now." Use turn count and compaction count as proxies.
- **`listSessions`/`getSessionMessages`.** Not in our SDK version. Don't parse JSONL unless we actually need session introspection (we don't yet).

### Open Questions for Spec

1. **Default policy per chain** — who decides? UI user, or inferred from chain metadata?
2. **Budget per chain** — hard limit or advisory? What happens when hit: error to user or silent fresh start?
3. **Scoped reset thresholds** — compaction count? time? turns? Configurable per chain?
4. **Verify options mutability on resume** — quick live test with haiku to confirm systemPrompt/allowedTools actually change behavior on resume.
