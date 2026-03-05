# Task Plan Phase 1: Foundation and Contract Freeze

## 1. Goal
Build a stable project foundation and freeze contracts before feature implementation.

## 2. Scope
Included:
1. Monorepo scaffold and toolchain.
2. Shared contracts and schema package.
3. Core and Web shell apps.
4. Baseline quality/security checks.

Excluded:
1. Dify runner implementation.
2. Plugin runtime business logic.
3. SubAgent/proactive/capability runtime.

## 3. Entry Criteria
1. Scope document is approved.
2. API contract draft exists.
3. Technical baseline doc exists.

## 4. Deliverables
1. `apps/core`, `apps/web`, `packages/shared` workspace.
2. Contract-first shared package with OpenAPI + TypeScript + validators.
3. Build, lint, and unit test pipelines passing.

## 5. Tasks

### P1-T001 Repository Structure Initialization
- Component: Infra
- Description: Create workspace structure and root workspace config.
- Output:
  - `pnpm-workspace.yaml`
  - root `package.json`
  - `apps/core/`, `apps/web/`, `packages/shared/`, `docs/`
- DoD:
  - `pnpm install` succeeds.
  - workspace packages are detected.
- Verify:
  - `pnpm -r list --depth -1`

### P1-T002 Root Toolchain Baseline
- Component: Infra
- Description: Add TypeScript, ESLint, Prettier, and shared tsconfig baseline.
- Output:
  - `tsconfig.base.json`
  - `.eslintrc.*`
  - `.prettierrc.*`
  - `.editorconfig`
  - `.gitignore`
- DoD:
  - `pnpm -r lint` and `pnpm -r typecheck` run in all packages.
- Verify:
  - `pnpm -r lint`
  - `pnpm -r typecheck`

### P1-T003 Shared Contract Package Bootstrap
- Component: Backend/Frontend
- Description: Initialize `packages/shared` with exports for contracts and schemas.
- Output:
  - `packages/shared/src/contracts/*`
  - `packages/shared/src/schema/*`
  - `packages/shared/src/generated/*` placeholder
- DoD:
  - both core and web can import from `@cwork/shared`.
- Verify:
  - `pnpm -r build`

### P1-T004 OpenAPI Source File and Generation Script
- Component: Backend/Frontend
- Description: Place OpenAPI source and generation workflow in shared package.
- Output:
  - `packages/shared/openapi/openapi.yaml`
  - `packages/shared/scripts/generate-openapi-types.*`
  - `packages/shared/src/generated/openapi.ts`
- DoD:
  - generated output is deterministic and committed.
- Verify:
  - `pnpm --filter @cwork/shared gen:openapi`

### P1-T005 Runtime Validator Baseline (Zod)
- Component: Backend/Frontend
- Description: Add Zod validators for runtime chat, Dify config, plugin/skill/subagent payloads.
- Output:
  - `packages/shared/src/schema/runtime.ts`
  - `packages/shared/src/schema/dify.ts`
  - `packages/shared/src/schema/plugin.ts`
  - `packages/shared/src/schema/subagent.ts`
- DoD:
  - validator tests cover valid/invalid inputs.
- Verify:
  - `pnpm --filter @cwork/shared test`

### P1-T006 Core Service Shell
- Component: Backend
- Description: Scaffold Node.js TypeScript core app with basic HTTP server and health routes.
- Output:
  - `apps/core/src/server.ts`
  - `GET /api/v1/healthz`
  - `GET /api/v1/readyz` (stub)
- DoD:
  - service starts and returns health responses.
- Verify:
  - `pnpm --filter @cwork/core dev`
  - `curl -s localhost:<PORT>/api/v1/healthz`

### P1-T007 Web App Shell
- Component: Frontend
- Description: Scaffold React 19 + Vite app with API client bootstrap.
- Output:
  - `apps/web/src/main.tsx`
  - basic route shell
  - typed API client using `@cwork/shared`
- DoD:
  - web app starts and displays backend health status.
- Verify:
  - `pnpm --filter @cwork/web dev`

### P1-T008 API Security Middleware Skeleton
- Component: Security
- Description: Add API auth middleware with request-id propagation and redaction utility skeleton.
- Output:
  - auth middleware
  - request-id middleware
  - redaction helper
- DoD:
  - unauthorized requests are rejected for protected routes.
- Verify:
  - integration test for `401` and successful authorized request

### P1-T009 Error Model Unification
- Component: Backend
- Description: Implement shared error mapping to `ErrorEnvelope` contract.
- Output:
  - `error-code.ts`
  - `http-error-mapper.ts`
- DoD:
  - validation/upstream/internal errors map to fixed codes.
- Verify:
  - unit tests for all error code mappings

### P1-T010 Baseline Persistence Interfaces
- Component: Backend
- Description: Define repository interfaces for session/config/plugin/skill/proactive entities.
- Output:
  - `apps/core/src/repo/interfaces.ts`
  - in-memory adapter for each interface
- DoD:
  - interfaces are consumed by stubs without direct DB coupling.
- Verify:
  - unit tests for in-memory repositories

### P1-T011 CI Baseline
- Component: Infra
- Description: Add CI workflow for lint/typecheck/test/build.
- Output:
  - `.github/workflows/ci.yml`
- DoD:
  - CI runs all workspace checks.
- Verify:
  - local workflow parity command: `pnpm -r lint && pnpm -r test && pnpm -r build`

### P1-T012 Documentation Alignment
- Component: Docs
- Description: Keep docs and code contracts aligned with generated artifacts.
- Output:
  - update `docs/api-contracts.md` references
  - add `packages/shared/README.md`
- DoD:
  - contributors can regenerate contract artifacts with one command.
- Verify:
  - docs command examples executed successfully

## 6. Exit Criteria
1. Workspace builds successfully end-to-end.
2. Shared contracts are generated and importable.
3. Core/Web shells run in local development.
4. CI baseline passes.

## 7. Risks and Mitigations
1. Risk: contract drift between backend and frontend.
- Mitigation: generated types are source-of-truth and validated in CI.
2. Risk: early framework churn.
- Mitigation: freeze framework versions in Phase 1 lockfile.

## 8. Phase Dependencies
1. No dependency on later phases.
2. Blocks all later phases.

## 9. Suggested Branching Strategy
1. `phase-1/foundation`
2. Merge gate requires all Phase 1 verification commands passing.

---
Status: Completed.
Date: 2026-03-05
