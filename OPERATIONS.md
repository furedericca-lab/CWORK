# OPERATIONS

## 1. Production Build and Start
Build:
```bash
pnpm -r build
```

Start core API:
```bash
pnpm start:core
```

Serve web static bundle for validation:
```bash
pnpm preview:web
```

## 2. Health Checks
```bash
curl -s http://127.0.0.1:8787/api/v1/healthz
curl -s http://127.0.0.1:8787/api/v1/readyz
curl -s -H "Authorization: Bearer dev-token" http://127.0.0.1:8787/api/v1/capabilities/status
```

## 3. Runtime Validation
```bash
curl -N \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"ops_sess","message":"healthcheck"}' \
  http://127.0.0.1:8787/api/v1/runtime/chat
```

Expected stream events include:
- `meta`
- `delta`
- `final_result`
- `done`

## 4. Capability Validation Shortlist
- Tools: `GET /api/v1/tools`
- Skills: `GET /api/v1/skills`
- Plugins: `GET /api/v1/plugins`
- MCP servers: `GET /api/v1/tools/mcp/servers`
- Subagents: `GET /api/v1/subagents`
- Proactive jobs: `GET /api/v1/proactive/jobs`
- Knowledge docs: `GET /api/v1/kb/documents`

## 5. Audit and Correlation
- Backend returns `x-request-id` header.
- Web console diagnostics panel stores recent request traces.
- Use request ID to correlate UI actions with backend logs.

## 6. Release Checks
Run full release gate:
```bash
pnpm release:check
```
