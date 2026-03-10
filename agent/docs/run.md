# Runbook

## When to Load
- Load only when executing, building, or validating.

## Scripts Location
- `./agent/scripts/` — all project scripts live here.

## Run
- `bun run dev` — start with file watcher (auto-restart on changes).
- `bun run start` — start without watcher (production).
- Service listens on port 18180 (`u-llm.local`).

## Test
- `bun test` — run all tests (47 tests as of spec 010).
- Tests located in `src/**/__tests__/*.test.ts`.

## Typecheck
- `bun run typecheck` — runs `tsc --noEmit`.

## Server Workspace
- Server root: `/Users/glebnikitin/work/server/`
- Convention: `<project>.local` domain, nginx conf in `nginx/conf.d/`, launchd plist, start script.
- Kill port + restart for service code updates (launchd auto-restarts).
