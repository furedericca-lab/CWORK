# AstrBot Refactor Scope and Milestones (Confirmed v1)

## 1. Purpose
This document freezes the confirmed delivery scope, non-scope, architecture baseline, milestones, and acceptance gates for the refactor.

Project target:
- Core: Node.js + TypeScript
- WebUI: React 19 + Vite
- Provider policy: Dify only
- Channel policy: no messaging platform adapters

Reference baseline:
- `/root/work/AstrBot/`
- `https://docs.astrbot.app/what-is-astrbot.html`

## 2. Confirmed In-Scope (Must Deliver)
1. Unified pipeline skeleton (event bus, stage scheduler, session context, message chain).
2. WebUI (configuration, runtime debugging, streaming output view).
3. Tools framework (registration, invocation, timeout control, result injection).
4. Skills framework (definition, loading, call policy constraints).
5. SubAgent orchestration (handoff routing and per-subagent configuration).
6. Proactive Agent capability (scheduled and proactive task triggering).
7. MCP integration (MCP server discovery and tool exposure).
8. Web search capability (as a unified search tool).
9. AstrBot knowledge base capability (ingestion, retrieval, RAG injection).
10. Agent sandbox runtime (controlled execution, timeout/resource guard, audit logging).
11. Local plugin architecture (import/install, enable, disable, reload, uninstall).
12. Dify provider support only (`chat`/`agent`/`chatflow`/`workflow`, streaming, conversation binding).

## 3. Confirmed Out-of-Scope (Do Not Build in v1)
1. Any non-Dify provider (OpenAI, Coze, DashScope, DeerFlow, etc.).
2. Any messaging platform adapter (Telegram, QQ, Slack, Lark, WeCom, etc.).
3. Plugin marketplace and online plugin catalog UX.
4. Multi-provider routing/pooling beyond Dify.

## 4. Architecture Baseline
1. Two-process architecture:
- `apps/core`: Node.js + TypeScript backend.
- `apps/web`: React 19 + Vite frontend.
2. Entry mode:
- v1 exposes API + WebUI only.
- No IM channel ingress in v1.
3. Core runtime layers:
- Event Bus + Pipeline Scheduler
- Session/Context state
- Dify Runner Provider layer
- Tools/Skills execution layer
- Plugin runtime layer
- SubAgent Orchestrator
- Proactive Scheduler
- MCP/Search/Knowledge/Sandbox capability adapters
4. Streaming transport:
- SSE is the default streaming channel.

## 5. Plugin Capability Baseline (Local Plugin First)
Required plugin capabilities in v1:
1. Import/install local plugin package.
2. Import/install plugin from Git repository URL (borrowing AstrBot import workflow behavior).
3. Enable plugin.
4. Disable plugin.
5. Reload plugin (hot reload target).
6. Uninstall plugin.
7. Ensure plugin execution is sandbox-aware and auditable.

Minimum plugin API/UI behavior:
1. WebUI plugin list shows status: `enabled` / `disabled` / `error`.
2. WebUI supports `enable`, `disable`, `import`, `reload`, `uninstall` actions.
3. Import result returns plugin metadata and human-readable errors.
4. Plugin load failure must not crash the core runtime.

## 6. Milestones and Definition of Done (DoD)

### M0 - Scope Freeze and Contract Definition
Deliverables:
1. Scope document (this file).
2. API contract draft for pipeline run, streaming, plugin management, and Dify configuration.
DoD:
1. Scope and non-scope are accepted.
2. Contract draft is reviewed.

### M1 - Core Skeleton (No Business Capability Yet)
Deliverables:
1. Monorepo structure (`apps/core`, `apps/web`, `packages/shared`).
2. Event bus, pipeline stage framework, session store, and message chain types.
DoD:
1. `pnpm -r build` passes.
2. `pnpm -r test` passes.
3. SSE smoke test works.

### M2 - Dify Provider (Single Provider)
Deliverables:
1. Dify API client and Dify runner (`chat`/`agent`/`chatflow`/`workflow`).
2. Session-based conversation binding (`dify_conversation_id`).
3. Streaming delta and final result output.
DoD:
1. Integration tests cover all four Dify modes.
2. Timeout and error model are standardized.

### M3 - Tools and Skills Runtime
Deliverables:
1. Tool registration and execution framework.
2. Skill loading and call-policy enforcement.
DoD:
1. Tool call lifecycle is visible in logs and WebUI debug panel.
2. Skill calls are test-covered.

### M4 - Local Plugin Runtime
Deliverables:
1. Plugin lifecycle: import/install, enable, disable, reload, uninstall.
2. Plugin state persistence and startup restore.
DoD:
1. Plugin lifecycle APIs pass end-to-end tests.
2. One sample plugin can be imported and toggled from WebUI.
3. Plugin failure isolation and recovery are verifiable.

### M5 - SubAgent and Proactive Agent
Deliverables:
1. SubAgent handoff orchestration.
2. Proactive task scheduler and session callback pipeline.
DoD:
1. At least two subagents can be routed by policy.
2. A scheduled proactive task can trigger and produce response chain output.

### M6 - MCP + Web Search + Knowledge Base + Sandbox
Deliverables:
1. MCP capability adapter.
2. Search tool adapter.
3. Knowledge ingestion/retrieval + RAG bridge.
4. Sandbox runtime with timeout/resource guard.
DoD:
1. All four capabilities are callable via the Tools layer.
2. Audit logs include call trace and error trace.

### M7 - WebUI Completion
Deliverables:
1. Settings pages for Dify, tools/skills, plugin manager, subagent, proactive tasks.
2. Runtime console for streaming, tool trace, and error visibility.
DoD:
1. Critical operations are fully operable without CLI.
2. Main UI E2E flow passes.

### M8 - Hardening and Release
Deliverables:
1. Security checklist and secret redaction policy.
2. CI pipeline (`lint/test/build/e2e`).
3. Deployment and operations documentation.
DoD:
1. Regression suite is green.
2. One-command dev startup and production build both run successfully.

## 7. Acceptance Gates
1. Functional gate: all in-scope items in Section 2 are delivered.
2. Scope gate: no out-of-scope item in Section 3 is introduced.
3. Quality gate: `lint/test/build/e2e` all pass.
4. Security gate: no secret leakage in logs or API errors.

## 8. Change Control
1. Adding any non-Dify provider or any messaging platform adapter is a scope change and requires explicit approval.
2. Adding plugin marketplace capability is a scope change and requires explicit approval.
3. If priorities change, update this document first, then update task breakdown.

---
Status: Confirmed and ready as implementation baseline.
Date: 2026-03-05
