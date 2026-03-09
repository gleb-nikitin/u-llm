# Project Context

## Snapshot
- Project: u-llm (LLM bridge adapters for u-msg)
- Workspace: /Users/glebnikitin/work/code/u-llm
- Domain: connects LLM providers as participants in u-msg messaging chains
- Active spec: none
- Next spec: 001
- Main modules: not yet implemented

## Current Focus
- Specs 001-004 drafted: SDK basic → CLI headless → sessions/streaming → HTTP service + deploy.
- Ready for spec acceptance and executor sessions.
- u-msg-ui available as donor for TS project setup and backend integration patterns.

## Agreed Constraints
- Separated MVPs — build focused increments, iterate once live.
- Claude Max OAuth auth (no API key), personal/internal use.
- Agent SDK is the primary integration path; CLI headless is secondary.
- u-msg backend is protocol authority — u-llm speaks its message contract.
- TypeScript + Bun stack (matches ecosystem).

## Risks
- No implementation yet — all context is reference material.
- Agent SDK stable V1 preferred over V2 preview for production reliability.
- Claude Max OAuth may need SSH tunnel for browser redirect on remote server deployment.
