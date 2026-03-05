# Task Plan Phase 2: Core Runtime and Dify Provider

## 1. Goal
Implement the runtime execution backbone and the only provider (Dify), including streaming and session-bound conversation behavior.

## 2. Scope
Included:
1. Event bus and pipeline scheduler.
2. Message chain model and serialization.
3. Session state store and conversation binding.
4. Dify API client and runner (`chat`, `agent`, `chatflow`, `workflow`).
5. Runtime chat SSE endpoint.

Excluded:
1. Plugin runtime lifecycle APIs.
2. Skills management and sandbox synchronization.
3. SubAgent orchestration.

## 3. Entry Criteria
1. Phase 1 exit criteria completed.
2. Shared contracts and validators available.

## 4. Deliverables
1. Functional runtime pipeline with deterministic stage order.
2. Dify runner behavior parity for conversation persistence and streaming.
3. SSE contract-compliant events.

## 5. Tasks

### P2-T001 Event and Pipeline Core
- Component: Backend
- Description: Implement event model, pipeline stage interfaces, and stage scheduler.
- Output:
  - `apps/core/src/pipeline/*`
  - deterministic stage registration and execution order
- DoD:
  - pipeline supports async and async-generator stages.
- Verify:
  - unit tests for stage order and stop-propagation behavior

### P2-T002 Baseline Stage Set
- Component: Backend
- Description: Implement initial stages: wake check, preprocess, process, result decorate, respond.
- Output:
  - `WakeCheckStage`
  - `PreprocessStage`
  - `ProcessStage`
  - `ResultDecorateStage`
  - `RespondStage`
- DoD:
  - each stage has isolated tests and can be toggled in test harness.
- Verify:
  - stage integration tests

### P2-T003 MessageChain Domain Model
- Component: Backend/Frontend
- Description: Implement canonical `MessagePart` conversion and normalization.
- Output:
  - normalization helper for string-or-parts input
  - message chain serializer/deserializer
- DoD:
  - input and output follow shared schema exactly.
- Verify:
  - schema validation tests for all part variants

### P2-T004 Session Store and Context Keys
- Component: Backend
- Description: Implement session repository and context keys needed for Dify and runtime flow.
- Output:
  - session repository adapter
  - keys: `difyConversationId`, `sessionVariables`, `activeConfigId`
- DoD:
  - session isolation guaranteed by `sessionId`.
- Verify:
  - multi-session concurrency tests

### P2-T005 Runtime Chat Endpoint
- Component: Backend
- Description: Implement `POST /api/v1/runtime/chat` endpoint with request validation.
- Output:
  - route + handler + validation middleware
- DoD:
  - rejects invalid request payload with `VALIDATION_ERROR` envelope.
- Verify:
  - API integration tests with valid/invalid payloads

### P2-T006 SSE Stream Writer
- Component: Backend
- Description: Implement SSE writer abstraction for contract event types.
- Output:
  - event serialization helper
  - heartbeat and graceful close logic
- DoD:
  - emits `meta`, `delta`, `final_result`, `done` in valid order.
- Verify:
  - SSE stream order tests

### P2-T007 Dify Config Loader and Validation
- Component: Backend
- Description: Implement Dify config loading with strict schema validation.
- Output:
  - `dify-config.service.ts`
  - validation + defaults + masking logic
- DoD:
  - supports only `chat|agent|chatflow|workflow`.
- Verify:
  - config service tests

### P2-T008 Dify API Client
- Component: Backend
- Description: Implement Dify HTTP client with timeout, retry policy, and stream parser.
- Output:
  - `chatMessagesStream`
  - `workflowRunStream`
  - `fileUpload`
- DoD:
  - stream parser handles incremental chunk, completion, and error frames.
- Verify:
  - contract tests using mocked Dify responses

### P2-T009 Dify Runner (`chat|agent|chatflow`)
- Component: Backend
- Description: Implement runner path for text-oriented Dify modes.
- Output:
  - streaming delta conversion to `MessagePart` chain
  - final result emission
- DoD:
  - one final result per run, with merged fallback handling.
- Verify:
  - integration tests for each non-workflow mode

### P2-T010 Dify Runner (`workflow`)
- Component: Backend
- Description: Implement workflow output parsing and file output mapping.
- Output:
  - parse `outputs[difyWorkflowOutputKey]`
  - map `files[]` to image/video/file parts
- DoD:
  - non-string outputs fallback to readable text representation.
- Verify:
  - fixture tests for output variants

### P2-T011 Conversation Binding
- Component: Backend
- Description: Persist and reuse `difyConversationId` by `sessionId`.
- Output:
  - conversation persistence adapter
  - reuse and reset logic
- DoD:
  - same session resumes same Dify conversation unless explicitly reset.
- Verify:
  - multi-turn integration tests

### P2-T012 Variable Merge Semantics
- Component: Backend
- Description: Merge variable layers for Dify requests.
- Output:
  - merge helper (`provider variables` + `sessionVariables` + runtime/system values)
- DoD:
  - merge order is deterministic and test-covered.
- Verify:
  - unit tests for override order and edge cases

### P2-T013 Runtime Session List Endpoint
- Component: Backend
- Description: Implement `GET /api/v1/runtime/sessions` with pagination.
- Output:
  - session list route + response mapping
- DoD:
  - output shape matches shared contract.
- Verify:
  - API tests for pagination and default values

### P2-T014 Dify Config Endpoints
- Component: Backend
- Description: Implement `GET/PUT /api/v1/config/dify`.
- Output:
  - read/write handlers
  - masked response fields
- DoD:
  - secret fields are never returned in plain text.
- Verify:
  - API tests for read, update, validation errors

### P2-T015 Runtime Observability Baseline
- Component: Backend/Security
- Description: Add request-id aware logging for runtime and Dify interactions.
- Output:
  - structured logs for run start/end, Dify call latency, and errors
- DoD:
  - logs include requestId/sessionId and masked secrets.
- Verify:
  - log snapshot tests or redaction tests

## 6. Exit Criteria
1. Runtime chat endpoint streams contract-compliant SSE events.
2. Dify four modes are fully test-covered.
3. Session conversation binding is stable and deterministic.
4. No secret leakage in responses or logs.

## 7. Risks and Mitigations
1. Risk: SSE ordering bugs under concurrent tool/capability events.
- Mitigation: single stream writer with sequencing and terminal-state guard.
2. Risk: Dify workflow output shape drift.
- Mitigation: fixture-based contract tests and tolerant parsing fallback.

## 8. Phase Dependencies
1. Depends on Phase 1.
2. Blocks Phases 3 to 5.

## 9. Suggested Branching Strategy
1. `phase-2/runtime-dify`
2. Merge gate requires all runtime and Dify integration tests passing.

---
Status: Ready for execution.
Date: 2026-03-05
