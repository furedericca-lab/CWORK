# CWORK

CWORK is a contract-first, Dify-only refactor of an AstrBot-style runtime:
- `apps/core`: backend API + orchestration runtime
- `apps/web`: WebUI operations console

v1 scope excludes:
- non-Dify providers
- messaging platform adapters
- plugin marketplace

## Quick Start (Development)

Prerequisites:
- Node.js 24+
- pnpm 10.30.3

Install and run:
```bash
pnpm install
pnpm dev
```

Run only one side:
```bash
pnpm --filter @cwork/core dev
pnpm --filter @cwork/web dev
```

Local API auth:
- default token is `dev-token`
- if changed, use the same token in WebUI and `Authorization: Bearer <token>`

## Quick Start (Deploy / Run)

Minimal production-like run:
```bash
cp .env.example .env
# set API_AUTH_TOKEN and DIFY_API_KEY in .env
pnpm -r build
pnpm start:core
pnpm preview:web
```

## Environment

Use `.env.example` as baseline. Key vars:
- `API_AUTH_TOKEN` (set non-default in non-dev environments)
- `DIFY_API_KEY`
- `CWORK_RUNTIME_MODE` (`none|local|sandbox`)
- `CWORK_SANDBOX_ENABLED`
- `VITE_API_BASE` (default `/api/v1`)

## Core Commands

```bash
pnpm -r lint
pnpm -r typecheck
pnpm -r test
pnpm -r build
pnpm -r e2e
pnpm security:check
pnpm perf:smoke
pnpm reliability:smoke
pnpm release:check
pnpm --filter @cwork/shared gen:openapi
```

## Operations Checks

Health:
```bash
curl -s http://127.0.0.1:8787/api/v1/healthz
curl -s http://127.0.0.1:8787/api/v1/readyz
curl -s -H "Authorization: Bearer dev-token" \
  http://127.0.0.1:8787/api/v1/capabilities/status
```

Runtime stream smoke:
```bash
curl -N \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"ops_sess","message":"healthcheck"}' \
  http://127.0.0.1:8787/api/v1/runtime/chat
```

Expected stream events: `meta`, `delta`, `final_result`, `done`.

## Security Baseline

- All management/runtime APIs require Bearer token except:
  - `GET /api/v1/healthz`
  - `GET /api/v1/readyz`
- Secret-like fields are redacted in logs.
- High-risk actions are audited:
  - plugin import
  - proactive create/delete
  - sandbox exec
- Web/Backend request correlation uses `x-request-id`.
- Restrict runtime capabilities with:
  - `CWORK_ALLOW_TOOLS`
  - `CWORK_DENY_TOOLS`
  - `CWORK_DENY_PLUGIN_CAPS`

## Troubleshooting (Fast)

`401 UNAUTHORIZED`:
- ensure Web token and backend `API_AUTH_TOKEN` match

Runtime chat not streaming:
- verify Dify config (`GET /api/v1/config/dify`)
- ensure provider key/env is present

Plugin/Skill import fails:
- validate local path / git ref / zip structure
- recheck with list APIs (`/plugins`, `/skills`)

Proactive job not running:
- validate timezone is IANA
- validate `runAt` or `cronExpression`

## Release Checklist (Condensed)

Before release:
1. Scope checks: Dify-only, no messaging adapters, no marketplace.
2. Quality gates: `pnpm -r lint && pnpm -r typecheck && pnpm -r test && pnpm -r build && pnpm -r e2e`.
3. Security gates: `pnpm security:check`.
4. Reliability gates: `pnpm perf:smoke && pnpm reliability:smoke`.
5. Deploy checks: core starts, web preview works, env aligned to `.env.example`.

Use `pnpm release:check` as the one-shot gate.

## Project Docs

- `docs/technical-documentation-v1.md`
- `docs/api-contracts-v1.md`
- `docs/astrbot-refactor-task-plans/5phases-checklist.md`
