# Session Management Brainstorm — u-llm

Briefing doc for brainstorm session. Contains SDK reference, current implementation state, CTO analysis, and open questions.

---

## Part 1: SDK Session Mechanics (from how-to-sdk-claude.md)

### Session Resume
- Pass `resume: sessionId` → SDK replays full history as input tokens
- Prompt caching automatic: system prompt + tools + unchanged history prefix cached at 0.1x cost
- `forkSession: true` → branch from resume point (new ID, original preserved)
- `resumeSessionAt: messageUUID` → partial resume, trim later messages
- `continue: true` → resume most recent session by last-modified

### All Options Mutable on Resume
You CAN change on every `query()` call, even when resuming:
- `systemPrompt` — change role/persona
- `model` — switch models mid-conversation
- `allowedTools` / `disallowedTools`
- `permissionMode`
- `maxTurns`, `maxBudgetUsd`
- `mcpServers`, `agents`

This is huge — same session, different behavior per turn.

### Session Creation
- Omit `resume` → auto-creates new session, ID arrives in init message
- No explicit "force new" needed

### Session Limits
- `maxTurns` / `maxBudgetUsd` → error result subtypes
- Auto-compaction when context fills up — summarizes older messages
- Compaction may lose early instructions → put critical rules in `systemPrompt` or CLAUDE.md, not conversation
- Manual: send `/compact` as prompt
- `PreCompact` hook available to archive transcript before summarization
- 1M context beta available: `betas: ['context-1m-2025-08-07']` (Sonnet 4/4.5)

### Session Clear / Reset
- **No API to clear while keeping same session_id**
- `/clear` → new session (new ID)
- `/compact` → summarize, keep same ID
- Omit `resume` → fresh session
- `persistSession: false` → ephemeral, can't resume later

### Concurrent Sessions
- No documented limit on count
- API rate limits (RPM/TPM) shared across all sessions
- Each `query()` = one child process

### Session Expiry
- Not documented. Files persist on disk indefinitely.

### System Prompt
```typescript
// Minimal — just tool instructions
systemPrompt: "You are a security auditor."

// Claude Code defaults + your additions (recommended)
systemPrompt: { type: 'preset', preset: 'claude_code', append: 'Focus on security.' }

// Full Claude Code prompt
systemPrompt: { type: 'preset', preset: 'claude_code' }
```
Must set `settingSources: ['project']` to load CLAUDE.md files.

### Model Selection
- `model` in options, different per session, changeable on resume
- Subagent models: `'sonnet' | 'opus' | 'haiku' | 'inherit'`

### Key Options Reference
```typescript
type Options = {
  resume?: string;
  forkSession?: boolean;
  persistSession?: boolean;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string };
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
  allowedTools?: string[];
  disallowedTools?: string[];
  settingSources?: ('user' | 'project' | 'local')[];
  cwd?: string;
  abortController?: AbortController;
}
```

### Result Carries
Every result message has: `total_cost_usd`, `usage`, `num_turns`, `session_id`.

### Hook Events
```
SessionStart  — source: 'startup' | 'resume' | 'clear' | 'compact'
SessionEnd    — reason: ExitReason
PreCompact    — trigger: 'manual' | 'auto'
Stop          — final cleanup
```

---

## Part 2: Current u-llm Implementation

### What We Have Now
- **One participant**: `UMSG_PARTICIPANT_ID = "u-llm"` (env-configurable)
- **Dumb 1:1 mapping**: chain_id → session_id, auto-create on first message
- **Always resume**: if session exists for chain, resume it. No policy, no role awareness.
- **No system prompt**: using SDK defaults (minimal tool instructions only)
- **No model selection**: hardcoded `"sonnet"` in `sdkQuery`
- **Flat JSON stores**: `data/chain-sessions.json` (chain→session map), `data/sessions.json` (session metadata)
- **No clear/reset**: no way to start fresh on existing chain

### Handler Flow (handler.ts)
```
WS event → filter (new_message, not self) → fetch full message from u-msg
→ check shouldRespond (notify/response_from includes us)
→ lookup session for chain → sdkQuery(prompt, {resume?})
→ persist session → writeMessage back to chain → markRead
```

### sdk-query.ts
- Takes prompt + options (model, resume, stream, onDelta)
- Returns { text, sessionId, durationMs, numTurns }
- Currently NOT passing: systemPrompt, permissionMode, maxTurns, maxBudgetUsd, settingSources, tools

---

## Part 3: Gleb's Intent

### Role Model
- Identity = `project-role` (e.g. `u-llm-cto`, `u-llm-executor`)
- Each role is a "contact" in the messaging system
- Roles have different session behavior:

| Role type | Session behavior | Examples |
|-----------|-----------------|----------|
| **Persistent** | Always resume, accumulate context | CTO, researcher, docs expert, bugs expert |
| **Fresh** | New session every time | Executor, Auditor |

- **Clear command**: user or LLM can explicitly reset a persistent session
- New chain = new session (u-msg creates chain_id when messaging a contact)
- LLM can also start new chains (initiate conversations)

### u-msg Constraints
- Chains are unbreakable — append only, no edit/delete
- New chain: send message to a participant_id, u-msg generates chain_id
- Branches planned but not now
- `response_from` field routes who should respond

---

## Part 4: CTO Analysis & Ideas

### The Core Design Question
**How does u-llm know which role a chain is for?**

Two approaches:

**A) Multiple participant IDs** — `u-llm-cto`, `u-llm-executor`, etc.
- Each role is a separate "contact" in u-msg
- u-llm registers/listens for all of them on WS
- UI just picks which contact to message — natural UX
- When Address Book arrives, each role is a real entry
- Downside: u-llm needs to register N participants with u-msg WS

**B) One participant, role in message meta** — always `u-llm`, role in metadata
- `response_from: "u-llm"` + `meta: { role: "cto" }`
- Simpler WS setup (one connection)
- Routing logic lives in u-llm handler
- Downside: UI needs to know about roles as metadata, not as contacts

**CTO recommendation: A.** Contacts are contacts. The UI doesn't need role-routing logic. Address Book will list real participants. Natural.

### Role Configuration
Each role needs:
- `participantId` — the u-msg identity (e.g. `u-llm-cto`)
- `sessionPolicy` — `persistent` | `ephemeral`
- `systemPrompt` — role-specific instructions (survives compaction)
- `model` — which Claude model to use
- `maxTurns` / `maxBudgetUsd` — per-query limits
- `permissionMode` — what the LLM can do
- `allowedTools` / `disallowedTools` — tool access per role

This could start as a static config file, later move to Address Book.

### Session Lifecycle Changes

**Current**: chain → session (1:1, always resume)

**Proposed**:
```
WS event arrives → extract participant_id from event
→ look up role config by participant_id
→ if ephemeral: always create new session (omit resume, persistSession: false)
→ if persistent: look up existing session for this chain
   → found: resume with role's options
   → not found: create new, store mapping
→ on "clear" command: discard session mapping, next message creates fresh
→ pass role's systemPrompt, model, tools, permissions to sdkQuery
```

### Clear Command
SDK can't clear in-place. So "clear" = discard session_id from our mapping. Next message auto-creates fresh.

Options for triggering clear:
1. Special message content: `/clear` — simple, but pollutes chat
2. Message type: `type: "command"` — clean, needs u-msg support
3. Message meta field: `meta: { command: "clear" }` — doesn't need u-msg changes

### What the UI Needs
- **Role list**: which contacts exist (hardcoded now, Address Book later)
- **Session status per role**: alive/fresh, turn count, last activity — could be a u-llm API endpoint
- **Clear button**: sends clear signal to reset a role's session
- **Model/role display**: show which model a contact uses

### System Prompt Strategy
Critical: don't put role instructions in conversation. They get lost on compaction.

Put them in:
1. `systemPrompt` option (re-injected every request) — role persona, behavior rules
2. CLAUDE.md via `settingSources: ['project']` — project-wide conventions
3. Conversation — only user messages

### What NOT to Build (yet)
- Custom compaction logic — SDK handles it
- Session garbage collection — disk files are small
- Token counting pre-flight — no reliable API
- Session introspection (reading JSONL) — not needed yet
- LLM-initiated chains — design later, implement later

---

## Part 5: Open Questions (Need Your Decisions)

### Q1: Approach A vs B?
Multiple participant IDs (A) vs one participant with role meta (B)?
CTO leans A. What does u-msg WS support? Can one WS connection listen for multiple participant_ids, or do we need N connections?

### Q2: How does "clear" reach u-llm?
- `/clear` in message content?
- Message meta field?
- Dedicated u-msg API?
What's natural for u-msg-ui?

### Q3: Role config — where does it live?
- Static JSON/TS config in u-llm? (simplest start)
- u-msg chain metadata?
- Address Book service? (future)
Can we start with static and migrate?

### Q4: WS multi-participant
If approach A: does u-msg WS support `?participant=u-llm-cto,u-llm-executor` or do we open N connections?
Need to check u-msg WS implementation.

### Q5: What should sdkQuery options look like?
Currently we pass only `model` and `resume`. We need to add:
- `systemPrompt` (per role)
- `permissionMode` (per role)
- `maxTurns` / `maxBudgetUsd` (per role)
- `settingSources` (project-wide)
- `persistSession` (false for ephemeral)
- `allowedTools` / `disallowedTools` (per role)

How much do we parameterize now vs keep simple?

### Q6: Budget and limits
- Hard limit per query? Per session lifetime? Per day?
- What happens when hit: error to user, silent fresh start, or warning?

### Q7: Do we need session stats in UI?
Turn count, cost, compaction count, last activity — useful for power user or overkill for now?

### Q8: Verify options mutability
The docs say all options can change on resume. Should we do a quick live test with haiku to confirm systemPrompt/model actually change behavior mid-session before building on this assumption?
