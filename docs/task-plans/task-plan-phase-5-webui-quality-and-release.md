# Task Plan Phase 5: WebUI Completion, Quality, and Release

## 1. Goal
Finish operational UX and release hardening so the refactor is usable and maintainable in production-like environments.

## 2. Scope
Included:
1. Full WebUI feature coverage for v1 scope.
2. End-to-end quality gates and observability integration.
3. Security hardening and release packaging.
4. Deployment and operation documentation.

Excluded:
1. Any out-of-scope feature from scope document (non-Dify providers, messaging adapters, plugin marketplace).

## 3. Entry Criteria
1. Phase 4 exit criteria completed.
2. Runtime capability set is stable and API contracts are frozen for v1.

## 4. Deliverables
1. WebUI supports all critical operations without CLI.
2. E2E and regression quality gates pass.
3. Production build and docs are release-ready.

## 5. Tasks

### P5-T001 Typed API Client Finalization
- Component: Frontend
- Description: Generate and consume shared API types in WebUI client layer.
- Output:
  - typed API client wrappers
  - centralized error mapping
- DoD:
  - no untyped API request/response path remains in WebUI.
- Verify:
  - TypeScript strict mode build passes

### P5-T002 Runtime Console UI
- Component: Frontend
- Description: Build runtime console for chat, SSE stream, and message chain rendering.
- Output:
  - `/chat` page
  - session selector
  - streaming timeline panel
- DoD:
  - renders `delta`, `final_result`, `error`, `done` correctly.
- Verify:
  - component tests and browser E2E chat flow

### P5-T003 Dify Settings UI
- Component: Frontend
- Description: Implement Dify config form with validation and save flow.
- Output:
  - `/settings/dify`
- DoD:
  - client validation matches shared schema.
- Verify:
  - form tests and integration test with mocked backend

### P5-T004 Plugin Manager UI
- Component: Frontend
- Description: Build plugin management page with lifecycle actions.
- Output:
  - list/import/enable/disable/reload/uninstall actions
  - status and error visualization
- DoD:
  - all plugin lifecycle actions are operable via UI.
- Verify:
  - E2E tests for plugin lifecycle

### P5-T005 Skills and Tools UI
- Component: Frontend
- Description: Build skills page and tools inventory/debug execution page.
- Output:
  - skills list/import/toggle/delete
  - tools list and debug execute panel
- DoD:
  - skill/tool state updates are reflected in near real-time.
- Verify:
  - integration tests for skills and tools pages

### P5-T006 MCP Management UI
- Component: Frontend
- Description: Build MCP server management page.
- Output:
  - add/update/delete/test server operations
  - runtime status and tool list per server
- DoD:
  - MCP actions align with backend responses and error states.
- Verify:
  - UI integration tests with mocked MCP responses

### P5-T007 SubAgent and Proactive UI
- Component: Frontend
- Description: Build subagent configuration and proactive jobs pages.
- Output:
  - subagent editor with tool picker
  - proactive jobs CRUD with run mode options
- DoD:
  - config persistence and job lifecycle are fully manageable in UI.
- Verify:
  - E2E tests for subagent and proactive flows

### P5-T008 Capability Health UI
- Component: Frontend
- Description: Build capability status panel for Dify/plugins/skills/mcp/search/knowledge/sandbox.
- Output:
  - health status page and badges
- DoD:
  - healthy/degraded/error states are clearly surfaced.
- Verify:
  - component tests for state rendering

### P5-T009 Structured Telemetry and Diagnostics
- Component: Backend/Frontend
- Description: Correlate frontend actions and backend request IDs in logs.
- Output:
  - trace propagation from UI to API headers
  - diagnostics panel with request IDs
- DoD:
  - operators can trace an issue from UI action to backend logs.
- Verify:
  - integration test for request-id propagation

### P5-T010 Security Hardening Pass
- Component: Security
- Description: Complete security checklist and high-risk endpoint validation.
- Output:
  - secret redaction verification
  - endpoint auth coverage report
  - dependency audit workflow
- DoD:
  - no critical findings in security checklist.
- Verify:
  - `pnpm audit` baseline
  - auth and redaction tests

### P5-T011 Full Test Matrix
- Component: QA
- Description: Build final test matrix: unit + integration + E2E + contract tests.
- Output:
  - CI workflow with segmented jobs
  - flaky test guardrails
- DoD:
  - green pipeline for required matrix.
- Verify:
  - `pnpm -r lint && pnpm -r test && pnpm -r build && pnpm -r e2e`

### P5-T012 Performance and Reliability Baseline
- Component: QA/Infra
- Description: Add baseline performance checks and runtime reliability tests.
- Output:
  - SSE long-session stability check
  - plugin failure stress scenario
- DoD:
  - no fatal memory/resource regressions in baseline scenarios.
- Verify:
  - scripted load/smoke reports

### P5-T013 Packaging and Deployment
- Component: Infra
- Description: Finalize production build and deployment approach.
- Output:
  - production build scripts
  - env var templates
  - optional bundled-web serving mode
- DoD:
  - production build starts with documented commands.
- Verify:
  - local production smoke test

### P5-T014 Operations Documentation
- Component: Docs
- Description: Complete developer and operator docs.
- Output:
  - `DEVELOPMENT.md`
  - `OPERATIONS.md`
  - `SECURITY.md`
  - `TROUBLESHOOTING.md`
- DoD:
  - docs cover setup, config, common failures, and recovery flows.
- Verify:
  - command snippets validated in local environment

### P5-T015 Release Readiness Checklist
- Component: Infra/Docs
- Description: Create release checklist and sign-off process.
- Output:
  - release checklist with owner and evidence fields
- DoD:
  - all checklist items have clear acceptance evidence.
- Verify:
  - dry-run release checklist execution

## 6. Exit Criteria
1. All in-scope features are operable from WebUI.
2. Full quality matrix passes in CI.
3. Security and operational docs are complete.
4. Production build and startup are validated.

## 7. Risks and Mitigations
1. Risk: UI/API contract drift late in project.
- Mitigation: generated client and contract tests in CI.
2. Risk: release blocked by unstable E2E tests.
- Mitigation: deterministic fixtures and staged retries for known flaky areas.

## 8. Phase Dependencies
1. Depends on Phases 1 to 4.
2. Final phase for v1 release.

## 9. Suggested Branching Strategy
1. `phase-5/webui-quality-release`
2. Merge gate requires complete test matrix and release checklist evidence.

## 10. Execution Progress (2026-03-05 Batch 1)
Completed in this batch:
1. P5-T001 Typed API Client Finalization
- Added full typed client wrappers in `apps/web/src/api/client.ts`.
- Added centralized error mapping with `ApiError`.
- Added request-trace emission and SSE parsing helpers.
2. P5-T002 Runtime Console UI
- Added runtime console with session selector, chat submit, SSE timeline, and final output rendering.
3. P5-T003 Dify Settings UI
- Added Dify config form with schema-aligned fields and save flow.
4. P5-T004 Plugin Manager UI
- Added import local/git + enable/disable/reload/uninstall controls.
5. P5-T005 Skills and Tools UI
- Added skill reload/import/toggle/delete.
- Added tools inventory and debug execute panel.
6. P5-T006 MCP Management UI
- Added add/update/test/enable/disable/delete controls.
7. P5-T007 SubAgent and Proactive UI
- Added subagent config JSON editor + available tool list.
- Added proactive job create/list/delete operations.
8. P5-T008 Capability Health UI
- Added overview capability health panel for all required capabilities.
9. P5-T009 Structured Telemetry and Diagnostics
- Added frontend request trace panel with `x-request-id` correlation.

Validation evidence for this batch:
1. `pnpm --filter @cwork/web lint`
2. `pnpm --filter @cwork/web typecheck`
3. `pnpm --filter @cwork/web test`
4. `pnpm --filter @cwork/web build`
5. `pnpm -r lint`
6. `pnpm -r typecheck`
7. `pnpm -r test`
8. `pnpm -r build`

Remaining tasks for phase completion:
1. Resolved in Batch 2 closure (see Section 11).

## 11. Closure Record (2026-03-05 Batch 2)
Completed in this closure batch:
1. P5-T010 Security Hardening Pass
- Added `test/security/auth-coverage.test.ts` for protected endpoint coverage.
- Added `test/security/redact.test.ts` for secret redaction verification.
- Added `SECURITY.md` and root security gate command (`pnpm security:check`).
2. P5-T011 Full Test Matrix
- Added segmented CI jobs in `.github/workflows/ci.yml`:
  - `lint`, `typecheck`, `test`, `build`, `e2e`, `security`.
- Added workspace `e2e` scripts and smoke tests:
  - core: `test/e2e/runtime-smoke.e2e.test.ts`
  - web: `src/e2e/console-smoke.e2e.test.ts`
3. P5-T012 Performance and Reliability Baseline
- Added `apps/core/scripts/perf-smoke.ts`.
- Added `apps/core/scripts/reliability-smoke.ts`.
- Added root shortcuts: `pnpm perf:smoke`, `pnpm reliability:smoke`.
4. P5-T013 Packaging and Deployment
- Added production startup script for core (`pnpm --filter @cwork/core start`).
- Added root command shortcuts: `start:core`, `preview:web`, `release:check`.
- Added `.env.example`.
5. P5-T014 Operations Documentation
- Added `DEVELOPMENT.md`, `OPERATIONS.md`, `SECURITY.md`, `TROUBLESHOOTING.md`.
6. P5-T015 Release Readiness Checklist
- Added `RELEASE-CHECKLIST.md` with sign-off fields and evidence gates.

Closure verification evidence:
1. `pnpm -r lint`
2. `pnpm -r typecheck`
3. `pnpm -r test`
4. `pnpm -r build`
5. `pnpm -r e2e`
6. `pnpm perf:smoke`
7. `pnpm reliability:smoke`
8. `pnpm security:check`

Exit criteria check:
1. All in-scope features operable from WebUI: passed.
2. Full quality matrix in CI/workspace: passed.
3. Security and operational docs complete: passed.
4. Production build/start commands validated: passed.

---
Status: Completed.
Date: 2026-03-05
