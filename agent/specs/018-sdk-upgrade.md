# Spec 018: SDK Upgrade (0.1.77 → 0.2.74)

## Goal

Upgrade `@anthropic-ai/claude-agent-sdk` from 0.1.77 to 0.2.74 (latest stable). Fix the one breaking change. Establish a reusable validation script for future SDK upgrades.

## Context

- SDK used in one file: `src/sdk-query.ts` (single import: `query`)
- All callers (`handler.ts`, `routes/query.ts`, `cli.ts`, `scripts/test-fork.ts`) use the `sdkQuery()` wrapper and never touch SDK types directly
- 0.1.x → 0.2.x is a semver boundary — one breaking change identified
- Safe rollback point: commit `2635b7c` (clean working tree)

## Breaking Change Analysis

### Must fix

**`allowDangerouslySkipPermissions`** — SDK 0.2.x requires `allowDangerouslySkipPermissions: true` in options when using `permissionMode: "bypassPermissions"`. Without it, the SDK rejects the config or falls back to interactive permissions, blocking all tool use in our headless service.

### Safe (no action needed)

| Change in 0.2.x | Why safe |
|---|---|
| New message types in `SDKMessage` union (SDKRateLimitEvent, SDKPromptSuggestionMessage, SDKTaskNotificationMessage, SDKToolUseSummaryMessage, etc.) | Duck-typing in message loop ignores unknown shapes |
| New fields on SDKResultMessage (`stop_reason`) | Not destructured by current code |
| New methods on Query object (`stopTask`, `setMcpServers`, `close`, etc.) | Not called |
| New exports (`listSessions`, `getSessionMessages`) | Not imported |
| New Options fields (`plugins`, `outputFormat`, `thinking`, `toolConfig`, etc.) | Not set |
| `ApiKeySource` adds `'oauth'` | Not checked |
| `ModelInfo` adds `supportsEffort`, `supportsAdaptiveThinking` etc. | Not used |
| `McpServerStatus` adds `'disabled'` status | Not checked |

## Deliverables

| File | Action |
|------|--------|
| `src/sdk-query.ts` | Modify: add `allowDangerouslySkipPermissions: true` to queryOptions |
| `package.json` | Modify: version `0.1.77` → `0.2.74` |
| `bun.lock` | Regenerate via `bun install` |
| `scripts/sdk-upgrade-check.ts` | Create: reusable validation script |
| `agent/docs/claude-agent-sdk-cli-parity-settings.md` | Modify: update version notes for 0.2.x |

## Behavior

### Step 1: Add permission guard (safe on both versions)

In `src/sdk-query.ts`, add `allowDangerouslySkipPermissions: true` to the `queryOptions` object (line ~72). This property is harmless on 0.1.77 (ignored as unknown key in `Record<string, unknown>`) and required on 0.2.x.

```typescript
const queryOptions: Record<string, unknown> = {
    model,
    permissionMode,
    allowDangerouslySkipPermissions: true,  // Required by SDK 0.2.x for bypassPermissions
    maxTurns,
    cwd: cwd ?? join(import.meta.dir, ".."),
    sandbox: { enabled: false },
    settingSources: ["project"],
    mcpServers: { ... },
};
```

### Step 2: Verify guard on current version

```bash
bun run typecheck && bun test
```

Both must pass before proceeding.

### Step 3: Bump version

In `package.json`, change:
```diff
-"@anthropic-ai/claude-agent-sdk": "0.1.77",
+"@anthropic-ai/claude-agent-sdk": "0.2.74",
```

### Step 4: Install

```bash
bun install
```

### Step 5: Validate

```bash
bun run typecheck        # type safety
bun test                 # regression
```

### Step 6: Create validation script

Create `scripts/sdk-upgrade-check.ts` — a reusable script with two modes:

**Static mode** (`bun scripts/sdk-upgrade-check.ts`):
1. Read `package.json`, report SDK version
2. Read `src/sdk-query.ts`, verify `allowDangerouslySkipPermissions` is present when `bypassPermissions` is used
3. Run `bun run typecheck`, report pass/fail
4. Run `bun test`, report pass/fail

**Live mode** (`bun scripts/sdk-upgrade-check.ts --live`):
1. All static checks above
2. Import `sdkQuery` from `../src/sdk-query.ts`
3. Run `sdkQuery("Reply with just: OK", { model: "haiku", maxTurns: 1 })`
4. Verify: non-empty `text`, non-empty `sessionId`, report `actualModel`

### Step 7: Run validation script

```bash
bun scripts/sdk-upgrade-check.ts          # static
bun scripts/sdk-upgrade-check.ts --live   # runtime smoke test
```

### Step 8: Update parity doc

In `agent/docs/claude-agent-sdk-cli-parity-settings.md`:
- Section 5: add `allowDangerouslySkipPermissions: true` to the options example
- Section 11: update minimum version notes for 0.2.x

### Step 9: Restart service and verify

```bash
# Restart via launchd (or manual)
# Verify through a real u-msg chain interaction
```

## Constraints

- **Minimal migration**: fix ONLY the breaking change, do not adopt new 0.2.x features
- **No changes** to `SdkEvent` interface, `SdkQueryOptions`, `SdkQueryResult`
- **No changes** to message duck-typing logic
- **No changes** to `handler.ts`, `routes/query.ts`, `cli.ts`, or `sse/hub.ts`
- **No refactoring** to use typed SDK message discriminated union

## Rollback

```bash
git checkout package.json bun.lock
bun install
# allowDangerouslySkipPermissions: true can stay (harmless on any version)
```

## Acceptance Criteria

- [x] 1. `package.json` shows `@anthropic-ai/claude-agent-sdk` version `0.2.74`
- [x] 2. `src/sdk-query.ts` contains `allowDangerouslySkipPermissions: true`
- [x] 3. `bun run typecheck` passes
- [x] 4. `bun test` passes
- [x] 5. `scripts/sdk-upgrade-check.ts` exists and runs without errors (static mode)
- [ ] 6. `scripts/sdk-upgrade-check.ts --live` returns valid result with model and session ID
- [x] 7. Parity doc updated with 0.2.x `allowDangerouslySkipPermissions` requirement

## Verification

```bash
bun scripts/sdk-upgrade-check.ts          # static checks
bun scripts/sdk-upgrade-check.ts --live   # runtime smoke test
bun run typecheck                         # type safety
bun test                                  # regression
```
