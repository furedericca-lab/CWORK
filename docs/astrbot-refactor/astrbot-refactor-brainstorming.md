---
description: Brainstorming and decision framing for the AstrBot-style refactor in CWORK.
---

# AstrBot Refactor Brainstorming

## Problem
CWORK needed a deterministic, contract-first runtime that preserves AstrBot-like orchestration capabilities without carrying multi-provider and messaging-channel complexity. The previous state had incomplete structure consistency across docs and task plans, which reduced repeatability and auditability.

## Scope
In scope:
- Unified runtime pipeline skeleton in `apps/core/src/pipeline/*`.
- Dify-only provider implementation in `apps/core/src/dify/*`.
- Web operations console in `apps/web/src/*`.
- Tool/skill/plugin runtime, subagent orchestration, proactive jobs, MCP/search/KB/sandbox adapters.
- Contract and documentation system under `docs/astrbot-refactor/*`.

Out of scope:
- Non-Dify providers.
- Messaging adapters.
- Plugin marketplace.

## Constraints
- Stack: Node.js + TypeScript backend, React 19 + Vite frontend.
- Contract-first workflow with shared schemas in `packages/shared/*`.
- Security baseline: bearer auth, redaction, audit logging.
- No architecture expansion to external microservices for v1.

## Options
1. Minimal runtime shell first, then iterative capability layering.
- Pros: low risk, stable incremental verification.
- Cons: requires strict phase discipline and docs upkeep.

2. Big-bang full capability implementation.
- Pros: faster feature visibility upfront.
- Cons: higher integration risk and low traceability on regressions.

3. Web-first UX before runtime internals.
- Pros: earlier UI demos.
- Cons: contract drift and mock-heavy rework risk.

## Decision
Choose option 1.
- Lock contracts and foundations first.
- Build runtime + Dify path second.
- Layer tools/skills/plugins, then subagent/proactive/capabilities.
- Finalize with WebUI completion and release hardening.

## Risks
- Contract drift between `packages/shared` and runtime/web usage.
- Runtime regression under feature layering (tools, subagent, proactive).
- Security drift if new surfaces miss auth/audit checks.

## Open Questions
- No remaining blocker for v1 scope; future work should be tracked as post-v1 enhancements in new scope docs.
