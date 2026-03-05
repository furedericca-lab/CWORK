# CWORK Scan Results (2026-03-05)

## Scope
This scan compares:
1. Refactor requirements under `docs/astrbot-refactor/*`
2. Current implementation under `apps/*` and `packages/*` in `/root/code/CWORK`
3. Baseline capability references from `/root/work/AstrBot`

Goal:
- Identify requirement mismatches
- Identify residual issues
- Identify conflict/regression risks

## Executed Validation Commands
- `pnpm -r lint`
- `pnpm -r typecheck`
- `pnpm -r test`
- `pnpm -r build`
- `pnpm -r e2e`
- `pnpm security:check`
- `pnpm perf:smoke`
- `pnpm reliability:smoke`

Result:
- All commands passed in current workspace.

## Findings (Ordered by Severity)

### 1) High: Contract source-of-truth drift (OpenAPI coverage gap)
Problem:
- `astrbot-refactor-contracts.md` defines OpenAPI as contract source-of-truth.
- Current OpenAPI only contains a small subset of implemented API surface.
- This creates SDK/client drift risk and release audit inconsistency.

Evidence:
- Contract source-of-truth statement:
  - `docs/astrbot-refactor/astrbot-refactor-contracts.md:15-18`
- OpenAPI paths are limited:
  - `packages/shared/openapi/openapi.yaml:8-168`
  - `packages/shared/src/generated/openapi.ts:688-699`
- Actual backend routes are significantly broader:
  - `apps/core/src/app.ts:237-693`
- Count snapshot during scan:
  - OpenAPI paths: 8
  - Core API routes: 45

Risk:
- Typed clients generated from OpenAPI will be incomplete.
- Future refactors can silently break real routes not represented in contract artifacts.

---

### 2) High: Proactive cron semantics mismatch (possible over-trigger)
Problem:
- Contract/examples describe cron expressions like `0 9 * * *`.
- Scheduler parser currently only understands `*/n` second/minute patterns.
- Unsupported expressions silently fall back to 60s interval.

Evidence:
- Contract example and behavior notes:
  - `docs/astrbot-refactor/astrbot-refactor-contracts.md:403-415`
- Current scheduler parsing behavior:
  - `apps/core/src/proactive/scheduler.ts:7-19`

Risk:
- A daily job can accidentally run every minute.
- Potential task storms, noisy output, and operational instability.

---

### 3) High: Persistence requirement not met by default runtime wiring
Problem:
- Milestones/DoD include persistent state and startup restore expectations.
- `buildApp` currently defaults to in-memory repositories.

Evidence:
- Persistence/startup expectations:
  - `docs/astrbot-refactor/astrbot-refactor-scope-milestones.md:107-114`
  - `docs/astrbot-refactor/task-plans/phase-4-astrbot-refactor.md:82-91`
- In-memory default wiring:
  - `apps/core/src/app.ts:112-115`
  - `apps/core/src/repo/memory.ts:44-218`

Risk:
- Restart loses Dify config/session/plugin/skill/proactive states.
- Production behavior can diverge from phase closure claims.

---

### 4) Medium: Capability adapters are mostly simplified stubs vs documented baseline
Problem:
- Current implementation is functional for test smoke, but does not yet match deeper technical baseline intent.

Evidence:
- Web search returns deterministic placeholder example.com entries:
  - `apps/core/src/capabilities/search/adapter.ts:47-67`
- Knowledge retrieval uses simple token-hit scoring and in-memory docs:
  - `apps/core/src/capabilities/knowledge/manager.ts:10-24`
  - `apps/core/src/capabilities/knowledge/manager.ts:99-119`
- MCP tool exposure is minimal (`mcp.list_servers`, `mcp.test_server` only):
  - `apps/core/src/tools/bootstrap.ts:31-56`
- Sandbox has timeout and output-size controls but no explicit CPU/memory isolation layer:
  - `apps/core/src/capabilities/sandbox/adapter.ts:91-117`

Cross-reference (upstream AstrBot baseline complexity):
- `astrbot/core/cron/manager.py`
- `astrbot/core/knowledge_base/kb_mgr.py`
- `astrbot/builtin_stars/web_searcher/main.py`

Risk:
- Future parity expectations may fail during deeper integration/UAT.
- Scope sign-off may be challenged if “functional parity” is interpreted strictly.

---

### 5) Medium: Security/operability contract deviations
Problem:
- `readyz` currently returns static success and does not verify deeper dependencies.
- Sensitive action `PUT /config/dify` has no explicit audit log entry.
- `dev-token` fallback remains active in both backend and frontend defaults.

Evidence:
- Contract readiness and security notes:
  - `docs/astrbot-refactor/astrbot-refactor-contracts.md:428-435`
- Static readyz:
  - `apps/core/src/app.ts:235`
- Dify config update route (no audit logger call around update):
  - `apps/core/src/app.ts:258-260`
- Default token fallback:
  - `apps/core/src/app.ts:53`
  - `apps/web/src/api/client.ts:34`
  - `apps/web/src/main.tsx:37-42`

Risk:
- Readiness signal may be overly optimistic.
- Audit trail gaps for sensitive config changes.
- Misconfiguration risk in non-dev deployments.

---

### 6) Low: Release sign-off still open in checklist
Problem:
- Final checklist still leaves release sign-off unchecked.

Evidence:
- `docs/astrbot-refactor/task-plans/5phases-checklist.md:275-278`

Risk:
- Procedural gap only; no immediate runtime impact.

## Residual Scan Status
- No `TODO/TBD/task-plan-` residual markers found under:
  - `docs/astrbot-refactor`
  - `README.md`

## Recommended Fix Order
1. Fix contract drift first:
- Align `openapi.yaml` and generated OpenAPI types with implemented routes.
- Decide whether docs or implementation is authoritative for each endpoint.

2. Fix proactive scheduling semantics:
- Implement real cron parsing or strict validation/rejection for unsupported expressions.
- Add tests for `0 9 * * *` and common 5-field cron formats.

3. Replace default in-memory repositories for runtime profiles requiring persistence:
- Keep in-memory for tests/dev only.
- Add explicit persistent storage backend and startup recovery tests.

4. Upgrade capability adapters progressively:
- Prioritize search and knowledge retrieval realism.
- Expand MCP tool exposure if required by scope interpretation.

5. Tighten security/ops posture:
- Make `readyz` dependency-aware.
- Add audit logging for Dify config updates.
- Remove `dev-token` fallback outside development mode.

## Conclusion
- Current codebase is buildable/testable and passes quality gates.
- Main risks are contract drift, proactive schedule semantics, and persistence mismatch against documented delivery expectations.

---

## Fix Status Update (2026-03-05)

### Fixed Items
1. OpenAPI contract drift
- `packages/shared/openapi/openapi.yaml` expanded to cover implemented core routes (tools/mcp/skills/subagents/proactive/kb/plugins/runtime/config/capabilities).
- Regenerated artifact: `packages/shared/src/generated/openapi.ts`.

2. Proactive cron semantics mismatch
- Added robust cron parser/matcher:
  - `apps/core/src/proactive/cron.ts`
- Scheduler now parses and matches cron expressions with timezone support:
  - `apps/core/src/proactive/scheduler.ts`
- Creation validation now rejects malformed cron:
  - `apps/core/src/proactive/manager.ts`
- Added tests:
  - `apps/core/test/proactive/cron.test.ts`
  - `apps/core/test/proactive/manager.test.ts` (invalid cron case)

3. Persistence default mismatch
- Added file-backed repositories:
  - `apps/core/src/repo/file.ts`
- Runtime defaults now use file repositories except test/memory mode:
  - `apps/core/src/app.ts`
- Added persistence restore test:
  - `apps/core/test/repo-file.test.ts`

4. Capability baseline gaps (search/knowledge/mcp/sandbox)
- Search adapter upgraded to provider-aware implementation with explicit fallbacks:
  - `apps/core/src/capabilities/search/adapter.ts`
- Knowledge retrieval upgraded to chunk-based scoring/citation:
  - `apps/core/src/capabilities/knowledge/manager.ts`
- MCP tool exposure expanded (add/update/enable/disable/delete):
  - `apps/core/src/tools/bootstrap.ts`
- Sandbox adds CPU/memory ulimit controls + audit fields:
  - `apps/core/src/capabilities/sandbox/adapter.ts`

5. Security/operability deviations
- `readyz` now checks dependencies instead of static success:
  - `apps/core/src/app.ts`
- Added audit logging for `PUT /config/dify` success/failure:
  - `apps/core/src/app.ts`
- Auth fallback hardened:
  - backend requires `API_AUTH_TOKEN` in production (`apps/core/src/app.ts`)
  - frontend `dev-token` fallback now dev-only (`apps/web/src/api/client.ts`, `apps/web/src/main.tsx`)

6. UI Chinese + no i18n
- Web UI visible text converted to Chinese:
  - `apps/web/src/main.tsx`
- Removed i18n bootstrap usage and file:
  - removed import in `apps/web/src/main.tsx`
  - deleted `apps/web/src/i18n.ts`
- Updated web e2e assertions:
  - `apps/web/src/e2e/console-smoke.e2e.test.ts`

### Validation Re-run (Post-fix)
- `pnpm -r lint`
- `pnpm -r typecheck`
- `pnpm -r test`
- `pnpm -r build`
- `pnpm -r e2e`
- `pnpm security:check`
- `pnpm perf:smoke`
- `pnpm reliability:smoke`

Result:
- All commands passed after fixes.

### Residual
- Checklist release sign-off item remains a process step (`docs/astrbot-refactor/task-plans/5phases-checklist.md:275-278`), not a runtime defect.
