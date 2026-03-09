# Case: Orchestration Patterns

Architecture patterns for multi-agent workflows, token efficiency, and context protection.

## Integration Patterns

### Pattern 1: CLI Wrapper (Quick Start)
```
Frontend → HTTP/WS → TS backend → spawns `claude -p` → parses JSON → streams to frontend
```

### Pattern 2: Agent SDK (Full Control)
```
Frontend → HTTP/WS → TS backend → query() → streams messages → forwards to frontend
```

### Pattern 3: Remote Server
- Install Claude Code on server.
- Authenticate once via `claude` (OAuth browser flow — may need SSH tunnel for browser redirect).
- Run SDK/CLI headless from backend service.
- Sessions persist at `~/.claude/projects/`.

## Token Efficiency

### Built-In Agent Teams vs External Orchestration
- The ~7x token multiplier applies ONLY to Claude Code's built-in `Task` tool agent teams (parent context stays open while children run concurrently).
- External orchestration (CTO → spec → executor → auditor → loop) does NOT incur this overhead — each session pays only for its own context.
- **Keep orchestration external**: pass artifacts between independent sessions instead of nesting agents via Task tool.

### Session Reuse with `/clear`
- Long-lived interactive sessions can be reused across tasks via `/clear`.
- `/clear` resets context but keeps process, auth, model config alive.
- Pattern: Auditor session receives artifact → reviews → output captured → `/clear` → next artifact.
- Avoids subprocess spawn overhead and re-authentication per task.
- Use `/rename` before `/clear` to preserve session history for later `/resume`.

## Protecting High-Value Context Windows

The CTO/architect agent (typically Opus) holds roadmap, architectural vision, accumulated decisions — most valuable context.

Rules:
1. NEVER let CTO spawn child agents via Task tool — child output pollutes CTO context.
2. CTO emits spec → external orchestrator routes to executor → executor output goes to auditor → auditor produces SHORT verdict → only verdict fed back to CTO.
3. CTO context accumulates only: roadmap + own specs + compact verdicts ("Task X: accepted" / "Task X: rejected, reason: ...").
4. Keep ALL git operations out of CTO context — delegate to a separate git agent or executor.
5. CTO receives only outcome summaries: "feature X merged to main" / "merge conflict on module Y, needs spec clarification".

### Orchestration Flow

```
CTO (Opus, long-lived) → spec artifact
  ↓ external orchestrator
Executor (Sonnet, disposable) → implementation
  ↓ external orchestrator
Auditor (separate session) → short accept/reject verdict
  ↓ external orchestrator (verdict only)
CTO ← compact verdict → writes next spec
```

## General Guidelines

- Delegate verbose operations (tests, logs, docs) to subagents — only summary returns to parent.
- Custom compaction: `/compact <instruction>` or set in CLAUDE.md.
- Sonnet for execution, Opus only for reasoning-heavy stages (CTO, auditor).
- Use `/stats` to monitor usage patterns (not `/cost` — irrelevant for subscription billing).
