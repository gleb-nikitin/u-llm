# Project Entry Point

## On Session Start
- Read `./AGENTS.md`.

## Tool Usage
- Before writing/editing a file, re-read it if the last read was not in the current turn. The Write tool rejects writes to files not recently read — avoid wasted turns by re-reading proactively when batch-writing multiple files.
## Local Services (reachable from this machine)
- u-msg API: http://chain-api.u-msg.local:18080 (chain data, messages)
- u-llm API: http://u-llm.local:18180 (participant status, SSE stream)

## Chain Message Access
When you receive a Chain_Message_ID (format: `{chain_id}_{seq}`), fetch it:
curl -s "http://chain-api.u-msg.local:18080/api/chains/{chain_id}/messages" | jq '.[] | select(.seq == {seq})'
Example: `Chain_Message_ID:chain_123_456_789_4` → chain_id=`chain_123_456_789`, seq=`4`
To get full chain history, omit the jq filter.
For summaries only (cheaper): GET /api/digest?for={participant_id}&limit={N}
