# Runbook

## When to Load
- Load only when executing, building, or validating.

## Scripts Location
- `./agent/scripts/` — all project scripts live here.

## Build
- No build step yet. Will use Bun when TS project is initialized.

## Run
- No runtime yet. Will be an always-on service (Bun, server workspace launchd).

## Test
- No automated tests yet.

## Validate
- No validation checks yet.

## Server Workspace
- Server root: `/Users/glebnikitin/work/server/`
- Convention: `<project>.local` domain, nginx conf in `nginx/conf.d/`, launchd plist, start script.
- Donor example: `u-msg-ui.conf` routes `chain-api.u-msg.local` → `:18080`, `ui.u-msg.local` → `:5173`.
