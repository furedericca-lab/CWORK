# Task Plan Phase 3: Tools, Skills, and Plugin Runtime

## 1. Goal
Deliver extensibility runtime with robust lifecycle management for tools, skills, and local plugins.

## 2. Scope
Included:
1. Tool registry and execution framework.
2. MCP tool integration and MCP server management.
3. Skills lifecycle (import/enable/disable/delete/reload).
4. Local plugin lifecycle (import/install, enable/disable, reload, uninstall).
5. Plugin isolation and failure containment.

Excluded:
1. SubAgent orchestration logic.
2. Proactive scheduler orchestration.
3. Knowledge/search/sandbox capability orchestration layer.

## 3. Entry Criteria
1. Phase 2 exit criteria completed.
2. Runtime chat and Dify runner are stable.

## 4. Deliverables
1. Tool and MCP runtime with management APIs.
2. Skill management APIs and sync hooks.
3. Plugin lifecycle APIs and state persistence.

## 5. Tasks

### P3-T001 Tool Registry and Schema Model
- Component: Backend
- Description: Implement runtime tool registry with typed schemas and active-state toggling.
- Output:
  - registry module
  - add/remove/list/toggle APIs
- DoD:
  - tool activation state persists and is queryable.
- Verify:
  - unit tests for registry behavior

### P3-T002 Tool Executor Core
- Component: Backend
- Description: Implement tool invocation engine with timeout and error wrapping.
- Output:
  - `execute(toolName, args, ctx)`
  - unified execution result model
- DoD:
  - timeout and failure paths map to stable error codes.
- Verify:
  - unit tests for timeout, exception, bad args

### P3-T003 Tool Trace Events
- Component: Backend
- Description: Emit `tool_call_start` and `tool_call_end` SSE events.
- Output:
  - stream hooks from executor to SSE writer
- DoD:
  - every started tool call has terminal event (`end` or `error`).
- Verify:
  - stream trace integration test

### P3-T004 MCP Config Store
- Component: Backend
- Description: Add MCP config persistence and validation.
- Output:
  - MCP config repository (`mcp_server.json` compatible shape)
  - validation for server name and transport config
- DoD:
  - invalid MCP config cannot be persisted.
- Verify:
  - API tests for MCP add/update/delete validation

### P3-T005 MCP Runtime Manager
- Component: Backend
- Description: Implement MCP runtime manager for enable/disable/test/list server operations.
- Output:
  - manager methods for init, enable, disable, shutdown
  - runtime state view
- DoD:
  - per-server lifecycle management is idempotent and timeout-safe.
- Verify:
  - integration tests with mocked MCP endpoints

### P3-T006 MCP API Endpoints
- Component: Backend
- Description: Implement MCP management endpoints.
- Output:
  - `GET /tools/mcp/servers`
  - `POST /tools/mcp/add`
  - `POST /tools/mcp/update`
  - `POST /tools/mcp/delete`
  - `POST /tools/mcp/test`
- DoD:
  - endpoint behavior and error mapping follow contract.
- Verify:
  - API integration tests

### P3-T007 Skill Inventory and Prompt Binding
- Component: Backend
- Description: Implement skill inventory loader and prompt generation helper.
- Output:
  - skill listing with `local_only|sandbox_only|both`
  - prompt block builder
- DoD:
  - active-only filtering and source labels are correct.
- Verify:
  - unit tests for list and prompt rendering

### P3-T008 Skill ZIP Import and Sanitization
- Component: Backend/Security
- Description: Implement secure `.zip` skill import with path traversal protection.
- Output:
  - import service based on sanitized extraction rules
- DoD:
  - malicious archives are rejected.
- Verify:
  - security tests for `..`, absolute path, multi-root zip cases

### P3-T009 Skill Management APIs
- Component: Backend
- Description: Implement skill routes for list/import/enable/disable/delete/download.
- Output:
  - `/skills` APIs as defined in contracts
- DoD:
  - sandbox-only skill constraints enforced.
- Verify:
  - integration tests for all skill actions

### P3-T010 Plugin Manifest and Compatibility Checks
- Component: Backend
- Description: Define plugin metadata manifest and compatibility validation.
- Output:
  - manifest parser
  - version compatibility checker
- DoD:
  - incompatible plugin is rejected with clear reason.
- Verify:
  - unit tests for compatibility matrix

### P3-T011 Plugin Import from Local Path
- Component: Backend
- Description: Implement local plugin import/install flow.
- Output:
  - local path importer
  - plugin metadata extraction
- DoD:
  - imported plugin appears in plugin list with correct source.
- Verify:
  - integration tests for local import path

### P3-T012 Plugin Import from Git URL
- Component: Backend
- Description: Implement git-based plugin import/install flow.
- Output:
  - git fetch/checkout with ref support
  - plugin install transaction handling
- DoD:
  - install failures are rolled back safely.
- Verify:
  - integration tests with temporary git fixture

### P3-T013 Plugin Enable/Disable/Reload/Uninstall
- Component: Backend
- Description: Implement plugin lifecycle operations and state transitions.
- Output:
  - lifecycle service
  - persistent `enabled/disabled/error` states
- DoD:
  - lifecycle operations are idempotent and recoverable.
- Verify:
  - e2e tests for lifecycle state transitions

### P3-T014 Plugin Failure Isolation
- Component: Backend/Security
- Description: Ensure plugin load/execute failures cannot crash core runtime.
- Output:
  - isolation guards and error boundaries
  - failed-plugin diagnostics
- DoD:
  - core remains healthy when a plugin fails to load.
- Verify:
  - fault-injection integration tests

### P3-T015 Plugin Management APIs
- Component: Backend
- Description: Implement plugin endpoints matching contract.
- Output:
  - `GET /plugins`
  - `POST /plugins/import/local`
  - `POST /plugins/import/git`
  - `POST /plugins/{id}/enable`
  - `POST /plugins/{id}/disable`
  - `POST /plugins/{id}/reload`
  - `DELETE /plugins/{id}`
- DoD:
  - API returns stable item schema and actionable errors.
- Verify:
  - API integration tests

### P3-T016 Tool and Plugin Permission Guardrails
- Component: Security
- Description: Add allow/deny controls for high-risk tools and plugin capabilities.
- Output:
  - permission policy module
  - enforcement hooks
- DoD:
  - restricted action is blocked with auditable reason.
- Verify:
  - policy enforcement tests

## 6. Exit Criteria
1. Tools and MCP management flows are stable.
2. Skills lifecycle is fully operational.
3. Plugin lifecycle is fully operational and isolated.
4. Runtime remains healthy under extension failures.

## 7. Risks and Mitigations
1. Risk: plugin dependency side effects.
- Mitigation: isolated install workspace and rollback transaction.
2. Risk: MCP runtime leaks resources.
- Mitigation: lifecycle manager with explicit shutdown and timeout controls.

## 8. Phase Dependencies
1. Depends on Phase 2.
2. Blocks Phase 4 and Phase 5 runtime integration.

## 9. Suggested Branching Strategy
1. `phase-3/extensibility-runtime`
2. Merge gate requires plugin/skill/tool integration suite passing.

---
Status: Ready for execution.
Date: 2026-03-05
