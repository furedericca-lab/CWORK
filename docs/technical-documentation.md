# Technical Documentation (v1 Baseline)

## 1. Objective
Define the technical architecture and engineering baseline for the AstrBot refactor with these constraints:
- Dify is the only provider.
- No messaging platform adapters.
- API + WebUI are the runtime entry points.

## 2. System Architecture

### 2.1 Topology
Two-process architecture:
1. Core service (`apps/core`): API, pipeline, runtime orchestration.
2. Web application (`apps/web`): operator UI and runtime console.

Optional deployment modes:
1. Split mode: Core and WebUI served separately.
2. Bundled mode: Core serves built static web assets.

### 2.2 Core Modules
1. `config`: typed config store and validation.
2. `event-bus`: internal async event dispatch.
3. `pipeline`: stage scheduler and stage contracts.
4. `session`: session state and persistence APIs.
5. `message`: message chain model and serialization.
6. `providers/dify`: Dify API client and Dify runner.
7. `tools`: tool registry, invoker, timeout and tracing.
8. `skills`: skill loader and policy manager.
9. `plugins`: plugin runtime manager and lifecycle hooks.
10. `subagents`: handoff orchestration.
11. `proactive`: scheduler and active trigger engine.
12. `capabilities`: MCP/search/knowledge/sandbox adapters.
13. `api`: HTTP routes, SSE transport, auth middleware.
14. `observability`: structured logs, metrics, audit logs.

### 2.3 WebUI Modules
1. Settings center (Dify config, capabilities, security toggles).
2. Runtime console (chat stream, tool trace, handoff trace, errors).
3. Plugin manager (import/enable/disable/reload/uninstall).
4. Skills and tools pages (inventory and debug execution).
5. SubAgent management page.
6. Proactive tasks page.

## 3. Runtime Data Models

### 3.1 MessageChain
Component types:
- `plain`
- `image`
- `video`
- `file`
- `reply`
- `record`

### 3.2 Session State
Minimum session keys:
- `sessionId`
- `difyConversationId`
- `sessionVariables`
- `activeConfigId`
- `lastActivityAt`

### 3.3 Plugin State
- `pluginId`
- `version`
- `source` (`local|git`)
- `status` (`enabled|disabled|error`)
- `lastError`
- `loadedAt`

### 3.4 Capability Status Model
For each capability (`mcp`, `search`, `knowledge`, `sandbox`):
- `enabled`
- `healthy`
- `lastCheckAt`
- `lastError`

## 4. Pipeline Design

### 4.1 Stage Interface
Each stage supports:
- `initialize(ctx)`
- `process(event)` (async / async-generator)

### 4.2 Baseline Stage Order
1. Waking check
2. Session and policy checks
3. Preprocess
4. Process stage (plugin/tools/subagent/provider)
5. Result decoration
6. Respond (SSE sink)

### 4.3 Streaming Semantics
1. Incremental `delta` events during generation.
2. Tool, handoff, and capability trace events interleaved.
3. Exactly one `final_result` per run.
4. Exactly one terminal `done` or `error`.

## 5. Dify Provider Design

### 5.1 Supported Modes
- `chat`
- `agent`
- `chatflow`
- `workflow`

### 5.2 Session Binding
Persist `difyConversationId` per `sessionId`.

### 5.3 Variables Merge Rule
Merged at request time in this order:
1. static provider `variables`
2. dynamic `sessionVariables`
3. runtime/system prompt variables

### 5.4 Timeout and Error Policy
1. Enforced request timeout per run.
2. Classified errors: validation, timeout, upstream, internal.
3. Redacted error details in logs and API responses.

## 6. Tools, Skills, and SubAgents

### 6.1 Tools
1. Typed tool schema.
2. Execution timeout guard.
3. Structured call trace (`start/end/error`).

### 6.2 Skills
1. Skill descriptor parser.
2. Load policy and access restrictions.
3. Skill reload support.

### 6.3 SubAgents
1. Router prompt-based handoff.
2. Optional per-subagent provider override (still Dify-backed).
3. Handoff trace emitted to SSE and logs.

## 7. Proactive Agent Design
1. Scheduler supports cron-based jobs.
2. Job execution re-enters pipeline with session context.
3. Job lifecycle states: `pending`, `running`, `succeeded`, `failed`, `cancelled`.
4. Job executions are auditable.

## 8. Capability Adapters

### 8.1 MCP
1. Discover MCP servers and resources.
2. Expose MCP operations as tools.

### 8.2 Web Search
1. Unified search tool interface.
2. Configurable provider backend.

### 8.3 Knowledge Base
1. Document ingestion pipeline.
2. Chunking + embedding + retrieval interface.
3. RAG context injection into provider requests.

### 8.4 Sandbox
1. Isolated execution runtime for risky operations.
2. Resource limits (CPU, memory, timeout).
3. Execution logs linked by request ID.

## 9. Plugin Runtime Design

### 9.1 Plugin Lifecycle
1. Import/install (local path or git URL).
2. Validate metadata and compatibility.
3. Enable/disable.
4. Reload.
5. Uninstall.

### 9.2 Failure Isolation
1. Plugin load/execute failure must not crash core.
2. Failed plugin enters `error` state with diagnostics.
3. Recovery path: reload or disable.

### 9.3 Plugin API Boundaries
1. Plugins interact via stable extension points.
2. No direct access to internal private modules.
3. Capability permissions are explicit and least-privilege.

## 10. Security Baseline
1. Authentication required for management APIs.
2. Secrets are env-based and masked at runtime.
3. No secret value in logs.
4. Redaction enforced in error and trace pipelines.
5. Audit logging for sensitive operations.

## 11. Observability and Operations
1. Structured logs with `requestId`, `sessionId`, `component`.
2. Capability health endpoints.
3. Readiness checks for Dify config and capability wiring.
4. Minimal metrics:
- request count
- request latency
- tool call count
- plugin error count
- scheduler job success/failure

## 12. Testing Strategy
1. Unit tests:
- pipeline stages
- Dify client/runner
- tool executor
- plugin lifecycle manager
2. Integration tests:
- SSE chat flow
- Dify mode coverage
- plugin import/enable/disable/reload/uninstall
- proactive job execution
3. E2E tests:
- WebUI critical flows
- runtime trace visibility

## 13. Non-Goals (v1)
1. Messaging platform adapters.
2. Non-Dify provider integrations.
3. Plugin marketplace and online catalog.

## 14. Risks and Mitigations
1. Risk: plugin instability impacts runtime.
- Mitigation: strict isolation + fail-safe state transitions.
2. Risk: streaming lifecycle race conditions.
- Mitigation: deterministic event ordering contract and integration tests.
3. Risk: capability adapter drift.
- Mitigation: adapter interfaces and contract tests.
4. Risk: secret leakage in traces.
- Mitigation: centralized redaction utility and tests.

---
Status: v1 technical baseline draft.
Date: 2026-03-05
