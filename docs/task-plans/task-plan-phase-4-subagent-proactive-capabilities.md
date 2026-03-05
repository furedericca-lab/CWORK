# Task Plan Phase 4: SubAgent, Proactive Flow, and Capability Adapters

## 1. Goal
Implement orchestration and advanced capabilities: SubAgent routing, proactive scheduling, MCP/search/knowledge/sandbox capability adapters integrated into runtime tools.

## 2. Scope
Included:
1. SubAgent orchestrator and handoff flow.
2. Proactive scheduler and active job execution flow.
3. Capability adapters: MCP/search/knowledge/sandbox.
4. Runtime capability status and observability.

Excluded:
1. WebUI completion and full UX polish.
2. Release hardening and production deployment packaging.

## 3. Entry Criteria
1. Phase 3 exit criteria completed.
2. Tool/plugin/skill runtime stable.

## 4. Deliverables
1. SubAgent routing with traceable handoff events.
2. Proactive cron-based task execution integrated with runtime sessions.
3. Capability adapters callable via tools.

## 5. Tasks

### P4-T001 SubAgent Config Domain Model
- Component: Backend
- Description: Implement typed SubAgent config model and normalization rules.
- Output:
  - `SubAgentConfig` model
  - backward compatibility mapping (`enable` -> `mainEnable`)
- DoD:
  - invalid config is rejected with field-level errors.
- Verify:
  - validation tests

### P4-T002 SubAgent Orchestrator Core
- Component: Backend
- Description: Implement orchestrator that builds handoff tools from config and persona settings.
- Output:
  - orchestrator service
  - handoff tool registration lifecycle
- DoD:
  - dynamic config update re-registers handoff tools safely.
- Verify:
  - integration tests for reload and handoff table changes

### P4-T003 SubAgent API Endpoints
- Component: Backend
- Description: Implement subagent config and available-tools endpoints.
- Output:
  - `GET /subagents`
  - `PUT /subagents`
  - `GET /subagents/available-tools`
- DoD:
  - route output includes normalized config and tool metadata.
- Verify:
  - API integration tests

### P4-T004 Handoff Event Tracing
- Component: Backend
- Description: Emit explicit `handoff` events in SSE and logs.
- Output:
  - handoff trace payload and request correlation
- DoD:
  - every subagent transition is observable in stream and logs.
- Verify:
  - stream trace tests

### P4-T005 Proactive Job Domain and Storage
- Component: Backend
- Description: Implement proactive job persistence model and repository.
- Output:
  - job model with `runOnce`, `cronExpression`, `runAt`, `timezone`, `status`
- DoD:
  - run-once and recurring jobs are both supported.
- Verify:
  - repository tests

### P4-T006 Scheduler Runtime
- Component: Backend
- Description: Integrate async scheduler for proactive jobs with startup recovery.
- Output:
  - scheduler service
  - sync jobs from storage on startup
- DoD:
  - persisted enabled jobs are restored and scheduled after restart.
- Verify:
  - integration tests with restart simulation

### P4-T007 Proactive Runtime Injection
- Component: Backend
- Description: Re-enter pipeline from scheduler with session context and metadata.
- Output:
  - proactive event builder
  - run-context metadata injection (`cron_job`, `origin`)
- DoD:
  - proactive runs produce normal runtime output chain.
- Verify:
  - end-to-end proactive execution tests

### P4-T008 Proactive API Endpoints
- Component: Backend
- Description: Implement proactive job list/create/delete endpoints.
- Output:
  - `GET /proactive/jobs`
  - `POST /proactive/jobs`
  - `DELETE /proactive/jobs/{jobId}`
- DoD:
  - validation and timezone handling are deterministic.
- Verify:
  - API tests for run-once and cron expressions

### P4-T009 Knowledge Base Adapter
- Component: Backend
- Description: Implement KB adapter and retrieval bridge for runtime and tool usage.
- Output:
  - kb manager integration
  - retrieval formatting and citation payload
- DoD:
  - retrieval can be invoked by tool and optionally injected into runtime context.
- Verify:
  - integration tests for retrieval flows

### P4-T010 Knowledge Base APIs
- Component: Backend
- Description: Implement minimal KB APIs for create/list/upload/retrieve/delete.
- Output:
  - `GET/POST /kb/*` routes aligned with contracts
- DoD:
  - async upload/import task status is available.
- Verify:
  - API tests with fixture documents

### P4-T011 Web Search Adapter
- Component: Backend
- Description: Build unified search tool adapter with provider abstraction.
- Output:
  - `web.search` tool
  - provider switches (`default|tavily|bocha|baidu_ai_search`)
- DoD:
  - search results have stable structure and optional citation metadata.
- Verify:
  - adapter tests for provider responses

### P4-T012 MCP Capability Bridge
- Component: Backend
- Description: Integrate MCP runtime outputs into general tool capability events.
- Output:
  - capability event mapping for MCP start/finish/error
- DoD:
  - MCP calls are observable in runtime streams.
- Verify:
  - integration tests with mocked MCP service

### P4-T013 Sandbox Runtime Adapter
- Component: Backend/Security
- Description: Integrate sandbox booter/runtime interface and enforce resource controls.
- Output:
  - runtime selector (`none|local|sandbox`)
  - timeout/resource limits in sandbox execution
- DoD:
  - sandbox-only operations are blocked when runtime is not sandbox.
- Verify:
  - policy tests and sandbox execution tests

### P4-T014 Sandbox Tool Set
- Component: Backend
- Description: Expose sandbox tools (shell/python/filesystem/browser as configured).
- Output:
  - runtime tool registration by sandbox capabilities
- DoD:
  - tool availability matches runtime capability profile.
- Verify:
  - tool inventory tests for each runtime mode

### P4-T015 Capability Status Endpoint
- Component: Backend
- Description: Implement capability status aggregation endpoint.
- Output:
  - `GET /capabilities/status`
- DoD:
  - includes `enabled`, `healthy`, `lastCheckAt`, `lastError` per capability.
- Verify:
  - API tests with healthy/degraded states

### P4-T016 Audit and Security Controls
- Component: Security
- Description: Add audit logs for high-risk operations (proactive create/delete, sandbox exec, plugin import).
- Output:
  - audit log pipeline and retention strategy stub
- DoD:
  - sensitive operation has actor, requestId, action, result in logs.
- Verify:
  - audit log assertion tests

## 6. Exit Criteria
1. SubAgent orchestration is config-driven and traceable.
2. Proactive jobs execute reliably and re-enter pipeline.
3. MCP/search/knowledge/sandbox are callable as tools.
4. Capability status and audit logging are in place.

## 7. Risks and Mitigations
1. Risk: orchestration loops between main and subagent.
- Mitigation: handoff guardrail and recursion/step limits.
2. Risk: proactive jobs trigger duplicate runs.
- Mitigation: scheduler idempotency key and status transitions.
3. Risk: sandbox misuse.
- Mitigation: strict permission policy and runtime-mode enforcement.

## 8. Phase Dependencies
1. Depends on Phase 3.
2. Blocks Phase 5 full UX and release readiness.

## 9. Suggested Branching Strategy
1. `phase-4/orchestration-capabilities`
2. Merge gate requires proactive/subagent/capability integration tests passing.

---
Status: Ready for execution.
Date: 2026-03-05
