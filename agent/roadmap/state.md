# Roadmap State

- active_spec: none
- last_finished: 010
- next_spec: TBD
- status_note: Spec 010 complete. Config simplified: IDs `{project}_{role}`, explicit project/role fields, `defaultModel` (full SDK string), `defaultEffort` (SDK effort option). `parseParticipantId`, `MODEL_MAP`, `modelShort` removed. API returns `{id, role, project, session}`. 47 tests passing. Session store has old IDs — will auto-create fresh entries on restart.
- context_entrypoint: ./agent/docs/kb.md
