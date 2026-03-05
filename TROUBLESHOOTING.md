# TROUBLESHOOTING

## 1. `401 UNAUTHORIZED` on API Calls
Symptoms:
- API responses return `UNAUTHORIZED`.

Checks:
```bash
echo "$API_AUTH_TOKEN"
curl -i -H "Authorization: Bearer dev-token" http://127.0.0.1:8787/api/v1/runtime/sessions
```

Fix:
- Ensure the token in client/web matches `API_AUTH_TOKEN` in core process.

## 2. Runtime Chat Not Streaming
Symptoms:
- `/runtime/chat` returns error or missing SSE events.

Checks:
```bash
curl -N -H "Authorization: Bearer dev-token" -H "Content-Type: application/json" \
  -d '{"message":"hello"}' http://127.0.0.1:8787/api/v1/runtime/chat
```

Fix:
- Verify Dify config via `GET /api/v1/config/dify`.
- Confirm provider keys are available in environment.

## 3. Plugin Import Failure
Symptoms:
- `POST /plugins/import/local` or `/plugins/import/git` fails.

Checks:
- Local path exists and contains valid plugin manifest.
- Git URL and ref are reachable.

Fix:
- Correct path/repo/ref.
- Re-import and verify with `GET /api/v1/plugins`.

## 4. Skill Import Failure
Symptoms:
- `POST /skills/import` fails validation.

Checks:
- ZIP has exactly one root folder.
- No unsafe archive paths.

Fix:
- Repack archive with single root and valid descriptor.

## 5. Proactive Jobs Not Running
Symptoms:
- Job remains pending, no runtime output.

Checks:
```bash
curl -s -H "Authorization: Bearer dev-token" http://127.0.0.1:8787/api/v1/proactive/jobs
```

Fix:
- Validate timezone (IANA names only).
- Confirm schedule fields (`runAt` or `cronExpression`) are valid.

## 6. MCP Server Test Fails
Symptoms:
- `POST /tools/mcp/test` returns failure.

Fix:
- Verify MCP server config and transport settings.
- Update config then retest.

## 7. Web Console Diagnostics
- Open Diagnostics panel in WebUI.
- Copy `x-request-id`.
- Search backend logs by request ID for root-cause tracing.
