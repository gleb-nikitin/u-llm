# u-llm SDK Session Management — Spec for Implementation

This document is the result of a brainstorm between Gleb and a planning agent.
It answers the open questions from `how-to-sdk-claude.md` and defines the session management approach for u-llm.

---

## Answers to Open Questions

### Q1: Default policy per chain — who decides?

**Answer: Inferred from participant ID, no config needed.**

Participant IDs follow the naming convention `{project}-{role}-{model}`. u-llm parses the participant ID and determines the session pattern from role:

| Role prefix | Session pattern | Why |
|-------------|----------------|-----|
| `cto` | resume + fork (golden checkpoint) | CTO accumulates decision history; needs persistent context with clean branching |
| `executor` | fresh every time + thin append | Executor gets spec + feedback in context; no memory needed between tasks |
| `auditor` | fresh every time + thin append | Auditor gets spec + implementation result; stateless |
| `git` | fresh every time + minimal append | Fire-and-forget commits |
| `research` | fresh every time + dynamic append | Research context assembled per query |
| `secretary` | simple resume (no fork) | Accumulates notes, todos; tech debpt, bugs |
| `coo` | simple resume (no fork) | Accumulates notes, todos; tech debpt, bugs |

No UI toggle needed for v1. The role IS the policy.
Simple Role config needed for user convinience.

### Q2: Budget per chain — hard limit or advisory?

**Answer: Advisory only for v1. No `maxBudgetUsd` in SDK options.**

- Log `total_cost_usd` from every `ResultMessage` per participant/session.
- No hard limits — Gleb controls scope through context and orchestration.
- Future: surface cost in UI per chain for visibility, add warnings later if needed.

### Q3: Scoped reset thresholds

**Answer: Not needed. The architecture avoids long-lived sessions.**

- CTO uses fork pattern — original session grows slowly (only accepted decisions), branches are disposable.
- All other roles use fresh sessions — no accumulation, no compaction.
- Secretary is the only simple-resume role, and note-taking sessions stay small.
- If CTO original ever hits compaction, that's a signal to manually promote a branch as new original.

### Q4: Verify options mutability on resume

**Answer: Still worth a quick test, but no longer blocking.**

The fork pattern depends on `forkSession: true` working correctly with `resume`. A quick test with Haiku (2 API calls, <$0.01) should confirm:
1. Create session, send a message, capture session_id.
2. Resume with `forkSession: true`, verify new session_id returned, verify original unchanged.

Not blocking because even if fork has issues, the fallback is manual: save original session_id, create fresh session with same context.

---

## Architecture Decisions

### No SessionStore needed for v1

The original `how-to-sdk-claude.md` proposed a `SessionEntry` interface with token tracking, compaction counts, etc. **This is not needed.**

What u-llm actually needs:

```typescript
// Simple map: participant_id → session state
interface ParticipantSession {
  participantId: string;        // e.g. "myproject-cto-o"
  role: string;                 // parsed from participant ID
  model: string;                // parsed from participant ID
  
  // CTO-specific (fork pattern)
  originalSessionId: string | null;   // golden checkpoint
  branchSessionId: string | null;     // current working branch
  
  // Secretary-specific (simple resume)
  sessionId: string | null;           // single persistent session
}
```

Stored as a JSON file on disk next to u-llm. Not in u-db, not in u-msg.

### Context assembly replaces session management

The core logic of u-llm is not session lifecycle — it's **context assembly**. For each incoming message, u-llm builds the right `systemPrompt.append` based on role:

```typescript
function buildAppend(role: string, projectId: string, incomingMessage: string): string {
  switch (role) {
    case 'cto':
      // CTO uses resume/fork — append is just the role prompt
      // History comes from the session itself
      return CTO_ROLE_PROMPT;
      
    case 'exec':
      return [
        EXECUTOR_ROLE_PROMPT,
        loadSpecForTask(projectId, incomingMessage),   // the spec to implement
        loadAuditFeedback(projectId, incomingMessage),  // if returning from audit
      ].filter(Boolean).join('\n\n');
      
    case 'audit':
      return [
        AUDITOR_ROLE_PROMPT,
        loadSpecForTask(projectId, incomingMessage),
        // implementation result comes in the message itself
      ].filter(Boolean).join('\n\n');
      
    case 'git':
      return GIT_ROLE_PROMPT;
      
    case 'secretary':
      // Secretary uses resume — append is just the role prompt
      return SECRETARY_ROLE_PROMPT;
      
    default:
      return DEFAULT_ROLE_PROMPT;
  }
}
```

### SDK options by role

```typescript
function buildOptions(session: ParticipantSession): Partial<Options> {
  const base = {
    systemPrompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: buildAppend(session.role, extractProjectId(session.participantId), ''),
    },
    model: MODEL_MAP[session.model],  // 'o' → opus, 's' → sonnet
    permissionMode: 'bypassPermissions' as const,
    maxTurns: 200,
    // mcpServers: configured per environment
  };

  switch (session.role) {
    case 'cto':
      return {
        ...base,
        resume: session.branchSessionId ?? session.originalSessionId ?? undefined,
        forkSession: session.originalSessionId !== null && session.branchSessionId === null,
        persistSession: true,
      };
    case 'secretary':
      return {
        ...base,
        resume: session.sessionId ?? undefined,
        persistSession: true,
      };
    default:
      // Fresh session — no resume, no persist
      return {
        ...base,
        persistSession: false,
      };
  }
}
```

### Model mapping

```typescript
const MODEL_MAP: Record<string, string> = {
  'o': 'claude-opus-4-5',
  's': 'claude-sonnet-4-5',
  'h': 'claude-haiku-4-5-20251001',
};

// Participant ID: "{project}-{role}-{model}"
// Examples:
//   umsg-cto-o     → role: cto,       model: opus
//   umsg-exec-s    → role: exec,      model: sonnet
//   umsg-audit-s   → role: audit,     model: sonnet
//   umsg-research-o → role: research, model: opus
```

---

## CTO Fork Pattern — Detailed Flow

### Initial setup

1. First message to CTO → fresh session created → capture `session_id` as `originalSessionId`.
2. Continue conversation in this session (resume, no fork) until context is "golden" — roadmap planned, decisions made.

### Working mode (after golden checkpoint exists)

Every subsequent interaction forks from original:

```
Message arrives for CTO participant
  → originalSessionId exists?
    YES → is there an active branch?
      YES → resume branchSessionId (continue branch conversation)
      NO → fork from originalSessionId (forkSession: true), store new ID as branchSessionId
    NO → fresh session, store as originalSessionId (first interaction)
```

### UI actions (mapped to u-msg operations)

**Save button** (promote branch to original):
- User clicks Save on the CTO branch participant
- u-llm receives signal (via u-msg message to a control channel, or dedicated endpoint)
- u-llm sets `originalSessionId = branchSessionId`, clears `branchSessionId`
- Next interaction will fork from the new original

**Delete branch** (discard and start fresh):
- User deletes CTO branch participant
- u-llm clears `branchSessionId`
- Next message auto-creates a new fork from original

**Delete original** (promote current branch):
- User deletes CTO save participant
- u-llm sets `originalSessionId = branchSessionId`, clears `branchSessionId`
- Same as Save

### Participant ID convention for CTO

```
{project}-cto-{model}        → branch (active conversation)
{project}-cto-{model}-save   → original (golden checkpoint, read-only unless explicitly resumed)
```

u-llm maps both to the same CTO session state, using the suffix to determine which session_id to use.

---

## What NOT to Build

From the original doc, confirmed and expanded:

- **Custom compaction logic** — not needed; CTO uses fork (branch compacts, original stays clean), others are ephemeral.
- **Session garbage collection** — disk files are small, let them accumulate.
- **Token counting** — log `total_cost_usd` from ResultMessage, nothing else.
- **JSONL parsing** — not needed for any current use case.
- **CLAUDE.md integration** — not using `settingSources`; context is injected dynamically via `systemPrompt.append`.
- **Complex SessionStore** — a JSON file with participant→session mapping is sufficient.
- **Budget enforcement** — advisory logging only.
- **maxBudgetUsd** — not set; rely on `maxTurns: 200` as safety net.

---

## Roadmap

### Phase 1: Basic session patterns (current)
- [ ] Implement participant ID parsing (`{project}-{role}-{model}`) (if model empty model = opus)
- [ ] Implement fresh session pattern for exec/audit/git roles
- [ ] Implement simple resume for secretary role
- [ ] Implement CTO fork pattern (original + branch)
- [ ] Role prompts in systemPrompt append
- [ ] JSON file session store on disk
- [ ] Log total_cost_usd per query

### Phase 2: UI integration
- [ ] Save button: promote CTO branch → original
- [ ] Delete branch: discard + auto-create new fork
- [ ] Delete original: promote branch as new original
- [ ] Cost visibility per participant in UI

### Phase 3: Dynamic context assembly
- [ ] CTO: curated decision history in append (replacing need for long sessions)
- [ ] Chain protocol as MCP tool for agents (search chain summaries, load context)
- [ ] Cross-project CTO brainstorm via chain protocol

### Phase 4: Automated orchestration (COO role)
- [ ] COO agent manages CTO→Executor→Auditor→Git cycle
- [ ] Automatic spec handoff between roles
- [ ] Roadmap completion tracking
