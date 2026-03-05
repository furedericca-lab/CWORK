# CWORK

A contract-first, Dify-only refactor baseline for an AstrBot-style runtime with two entry points:

- **Core service** (`apps/core`): API + runtime orchestration
- **WebUI** (`apps/web`): operator UI + runtime console

Non-goals (v1): messaging platform adapters, non-Dify providers.

## Repository layout

- `apps/core/` – backend API, pipeline, runtime orchestration
- `apps/web/` – WebUI (operator console)
- `packages/shared/` – shared contracts + generated types
- `docs/` – architecture + API contract drafts + milestone plans

## Prerequisites

- Node.js (recommended: modern LTS)
- pnpm (this repo is pinned via `packageManager` in `package.json`)

## Getting started

```bash
pnpm install
pnpm dev
```

## Common commands

```bash
pnpm dev        # run all packages in dev mode
pnpm build      # build all packages
pnpm test       # run tests across the workspace
pnpm lint       # lint all packages
pnpm typecheck  # run TypeScript typechecks
```

## Docs

Start here:

- `docs/technical-documentation.md` – architecture baseline (core modules, WebUI modules, pipeline)
- `docs/api-contracts.md` – API/SSE contract draft + shared type draft
- `docs/task-plans/` – milestone checklists and phased implementation plan
- `DEVELOPMENT.md` – development workflow and quality gates
- `OPERATIONS.md` – runtime operations and smoke checks
- `SECURITY.md` – auth/redaction/audit baseline and security checks
- `TROUBLESHOOTING.md` – common failures and recovery steps
- `RELEASE-CHECKLIST.md` – release sign-off checklist

Progress management:
- Source of truth checklist: `docs/task-plans/task-plan-5phases-checklist.md`
- Current implementation must follow the phase plans linked from that checklist.

Reference implementations:
- `AstrBot`: `/root/work/AstrBot`
- `open-cowork`: `/root/work/open-cowork`
- `openclaw`: `/root/work/openclaw`

## What Still Needs Improvement

- Add stronger runtime observability coverage (latency histograms and richer lifecycle snapshots).
- Expand SSE robustness tests for disconnect/reconnect and heartbeat timeout behavior under long-running tool calls.
- Add OpenAPI contract drift check in CI (generated artifact diff gate).
- Add browser-driven E2E coverage for critical UI action sequences beyond smoke level.

## Notes

- Local Codex state (`.codex/`) is intentionally **gitignored**.
- Secrets must be provided via environment variables; do not commit `.env` files.
