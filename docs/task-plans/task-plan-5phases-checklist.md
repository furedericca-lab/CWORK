# Refactor 5-Phase Checklist (Execution and Verification Hub)

## Purpose
This document is the single checklist hub for:
1. Tracking completion status for each phase.
2. Recording actual implementation progress and evidence.
3. Recording implementation issues, blockers, and resolutions.
4. Serving as the entrypoint to all 5 phase task-plan documents.

## How to Use
1. Start from this file before each implementation session.
2. Update phase-level status and evidence after each merged task batch.
3. Log issues immediately under the matching phase section.
4. Mark a phase as `Completed` only after all exit criteria are verified.

## Global Status
- Overall Program Status: `In Progress (Phase 1-3 Completed, Phase 4 In Progress)`
- Last Updated: `2026-03-05`
- Owner: `Codex + User`

## Phase Entry Links
1. Phase 1: [task-plan-phase-1-foundation-and-contracts.md](/root/code/CWORK/docs/task-plans/task-plan-phase-1-foundation-and-contracts.md)
2. Phase 2: [task-plan-phase-2-core-runtime-and-dify.md](/root/code/CWORK/docs/task-plans/task-plan-phase-2-core-runtime-and-dify.md)
3. Phase 3: [task-plan-phase-3-tools-skills-plugin-runtime.md](/root/code/CWORK/docs/task-plans/task-plan-phase-3-tools-skills-plugin-runtime.md)
4. Phase 4: [task-plan-phase-4-subagent-proactive-capabilities.md](/root/code/CWORK/docs/task-plans/task-plan-phase-4-subagent-proactive-capabilities.md)
5. Phase 5: [task-plan-phase-5-webui-quality-and-release.md](/root/code/CWORK/docs/task-plans/task-plan-phase-5-webui-quality-and-release.md)

## Phase Summary Board
| Phase | Name | Status | Completion | Implementation Health | Blocking Issues |
|---|---|---|---|---|---|
| 1 | Foundation and Contract Freeze | Completed | 100% | Healthy | 0 |
| 2 | Core Runtime and Dify Provider | Completed | 100% | Healthy | 0 |
| 3 | Tools, Skills, and Plugin Runtime | Completed | 100% | Healthy | 0 |
| 4 | SubAgent, Proactive, Capability Adapters | In Progress | 85% | Healthy | 0 |
| 5 | WebUI Completion, Quality, and Release | Not Started | 0% | Unknown | 0 |

## Phase 1 Checklist
- Phase Document: [task-plan-phase-1-foundation-and-contracts.md](/root/code/CWORK/docs/task-plans/task-plan-phase-1-foundation-and-contracts.md)
- Phase Status: `Completed`
- Completion: `100%`
- Implementation Health: `Healthy`

### Completion Checklist
- [x] All Phase 1 tasks completed.
- [x] All Phase 1 verification commands passed.
- [x] Phase 1 exit criteria validated.

### Implementation Progress Notes
- Monorepo foundation finalized: `apps/core`, `apps/web`, `packages/shared`, root toolchain, editor and ignore baselines.
- Contract package completed with shared TypeScript contracts, Zod validators, OpenAPI source (`openapi.yaml`), deterministic generation script, and generated artifact.
- Core shell upgraded with health/readiness, runtime/session/config stubs, request-id propagation, bearer auth middleware, redaction utility, error mapping, and in-memory repository interfaces/adapters.
- Web shell upgraded with typed API client (`@cwork/shared`) and runtime health status panel via React Query.
- CI baseline added (`.github/workflows/ci.yml`) with generate/lint/typecheck/test/build gates.

### Evidence (Commands / CI / PRs)
- `pnpm -r list --depth -1` (workspace package detection passed)
- `pnpm --filter @cwork/shared gen:openapi` (generation passed)
- `pnpm -r lint` (passed)
- `pnpm -r typecheck` (passed)
- `pnpm -r test` (passed)
- `pnpm -r build` (passed)
- `pnpm --filter @cwork/core dev` + `curl http://127.0.0.1:8787/api/v1/healthz` => `{\"ok\":true}`
- `pnpm --filter @cwork/web dev --host 127.0.0.1 --port 5173` + `curl http://127.0.0.1:5173/` => HTML response

### Issues and Blockers
- Temporary issue: accidental `.js/.d.ts` artifacts were emitted into `apps/core/src`, causing lint parse errors.

### Resolutions and Decisions
- Resolved by deleting generated artifacts, keeping build output in `dist`, and retaining strict workspace verification commands.

## Phase 2 Checklist
- Phase Document: [task-plan-phase-2-core-runtime-and-dify.md](/root/code/CWORK/docs/task-plans/task-plan-phase-2-core-runtime-and-dify.md)
- Phase Status: `Completed`
- Completion: `100%`
- Implementation Health: `Healthy`

### Completion Checklist
- [x] All Phase 2 tasks completed.
- [x] All Phase 2 verification commands passed.
- [x] Phase 2 exit criteria validated.

### Implementation Progress Notes
- Implemented runtime backbone modules under `apps/core/src/pipeline/*` with deterministic stage order and stop-propagation support.
- Added baseline stage set: `WakeCheckStage`, `PreprocessStage`, `ProcessStage`, `ResultDecorateStage`, `RespondStage`.
- Added message-chain domain module (`apps/core/src/message/chain.ts`) for string/part normalization and serializer/deserializer.
- Implemented runtime SSE writer abstraction with heartbeat/terminal guards (`apps/core/src/sse/writer.ts`).
- Added Dify config service (`apps/core/src/dify/dify-config.service.ts`) with schema validation, masking, env-template key resolution.
- Added Dify stream parser and client (`apps/core/src/dify/stream-parser.ts`, `apps/core/src/dify/api-client.ts`) with timeout+retry behavior.
- Added Dify runner (`apps/core/src/dify/runner.ts`) for `chat|agent|chatflow|workflow` with conversation binding and workflow output mapping.
- Added variable merge semantics helper (`apps/core/src/dify/variables.ts`) with deterministic precedence.
- Reworked runtime chat endpoint to use `RuntimeChatService` and pipeline (`apps/core/src/runtime/runtime-chat.service.ts`).
- Added request-id/session-aware runtime completion logs and kept secret redaction in error logs.

### Evidence (Commands / CI / PRs)
- `pnpm -r lint` (passed)
- `pnpm -r typecheck` (passed)
- `pnpm -r test` (passed; core test files: 13, tests: 32)
- `pnpm -r build` (passed)
- Coverage highlights:
  - pipeline stage order + stop propagation tests
  - stage integration tests
  - message-chain normalization tests
  - SSE event order + heartbeat tests
  - Dify config/client/parser/runner tests (including mode coverage and workflow mapping)
  - session conversation binding concurrency test
  - runtime route integration tests (`/runtime/chat`, `/runtime/sessions`, `/config/dify`)

### Issues and Blockers
- Type-system friction from `exactOptionalPropertyTypes` during Phase 2 implementation.

### Resolutions and Decisions
- Unified optional field typing in shared contracts and runtime session/config models to avoid undefined-assignment drift.
- Added strict fallback handling for missing final pipeline result and workflow non-string outputs.

## Phase 3 Checklist
- Phase Document: [task-plan-phase-3-tools-skills-plugin-runtime.md](/root/code/CWORK/docs/task-plans/task-plan-phase-3-tools-skills-plugin-runtime.md)
- Phase Status: `Completed`
- Completion: `100%`
- Implementation Health: `Healthy`

### Completion Checklist
- [x] All Phase 3 tasks completed.
- [x] All Phase 3 verification commands passed.
- [x] Phase 3 exit criteria validated.

### Implementation Progress Notes
- Added tool runtime foundation (`registry`, `executor`, bootstrap tools) with timeout/error wrapping and audit hooks.
- Closed tool management lifecycle with `enable/disable/remove/reload` endpoints and persisted activation state.
- Added MCP config/runtime support with repository shape, runtime manager, and management APIs.
- Added MCP lifecycle endpoints for `enable/disable` to complete runtime state control loop.
- Added skill runtime manager with inventory reload, prompt binding helper, lifecycle APIs, and ZIP import sanitization checks.
- Enforced `sandbox_only` skill enable constraint when sandbox mode is not enabled.
- Added plugin runtime with manifest parser, compatibility checks, local/git import, lifecycle APIs, and load-failure isolation.
- Hardened plugin runtime: `reload` persistence fix, idempotent uninstall, and `.git` metadata cleanup on install.
- Wired tool trace emission (`tool_call_start`, `tool_call_end`) into runtime chat SSE pipeline.
- Extended shared contracts + schemas for tools/MCP/skills, and expanded integration/unit test coverage.

### Evidence (Commands / CI / PRs)
- `pnpm -r lint` (passed)
- `pnpm -r typecheck` (passed)
- `pnpm -r test` (passed; core: 20 files, 48 tests)
- `pnpm -r build` (passed)

### Issues and Blockers
- No blocking issue in Phase 3 closure.

### Resolutions and Decisions
- Addressed strict TS edge cases for optional fields and error-safe async wrapping in tool execution path.
- Completed Phase 3 with additive APIs and hardening that do not expand out-of-scope provider/channel boundaries.

## Phase 4 Checklist
- Phase Document: [task-plan-phase-4-subagent-proactive-capabilities.md](/root/code/CWORK/docs/task-plans/task-plan-phase-4-subagent-proactive-capabilities.md)
- Phase Status: `In Progress`
- Completion: `85%`
- Implementation Health: `Healthy`

### Completion Checklist
- [ ] All Phase 4 tasks completed.
- [x] All Phase 4 verification commands passed.
- [ ] Phase 4 exit criteria validated.

### Implementation Progress Notes
- Added SubAgent config model + normalization (`enable` backward mapping) and orchestrator-driven handoff tool lifecycle.
- Added SubAgent API set (`GET/PUT /subagents`, `GET /subagents/available-tools`) and runtime `handoff` SSE tracing.
- Added proactive domain manager and startup-restored scheduler with pipeline re-entry metadata (`origin=cron_job`, `cronJobId`).
- Added proactive APIs (`GET/POST/DELETE /proactive/jobs`) with audit logging for create/delete.
- Added capability adapters and tools:
  - `web.search` unified adapter (`default|tavily|bocha|baidu_ai_search` shape)
  - knowledge manager + `kb.retrieve` tool + KB APIs (`/kb/documents`, `/kb/tasks/:taskId`, `/kb/retrieve`)
  - sandbox runtime adapter with mode-based tool registration (`sandbox.exec` in sandbox mode)
- Added capability status aggregation endpoint: `GET /capabilities/status`.
- Added audit logger and wired high-risk operation audit trails (`plugin import`, `proactive create/delete`, `sandbox.exec`).
- Expanded shared contracts/schemas for phase-4 entities (subagent config, proactive job, capability status, knowledge types).

### Evidence (Commands / CI / PRs)
- `pnpm -r lint` (passed)
- `pnpm -r typecheck` (passed)
- `pnpm -r test` (passed; shared: 15 tests, core: 57 tests)
- `pnpm -r build` (passed)

### Issues and Blockers
- No blocking issue currently.

### Resolutions and Decisions
- Implemented deterministic scheduler baseline with support for one-shot jobs and interval-style cron expressions (`*/N` seconds/minutes) for runtime safety in this phase.

## Phase 5 Checklist
- Phase Document: [task-plan-phase-5-webui-quality-and-release.md](/root/code/CWORK/docs/task-plans/task-plan-phase-5-webui-quality-and-release.md)
- Phase Status: `Not Started`
- Completion: `0%`
- Implementation Health: `Unknown`

### Completion Checklist
- [ ] All Phase 5 tasks completed.
- [ ] All Phase 5 verification commands passed.
- [ ] Phase 5 exit criteria validated.

### Implementation Progress Notes
- `TBD`

### Evidence (Commands / CI / PRs)
- `TBD`

### Issues and Blockers
- None.

### Resolutions and Decisions
- None.

## Final Release Gate
- [ ] All 5 phases marked `Completed`.
- [ ] Full quality gate passed (`lint/test/build/e2e`).
- [ ] Security checks completed.
- [ ] Release checklist signed off.

---
Status: Active checklist hub.
Date: 2026-03-05
