# SECURITY

## 1. Security Baseline
- All management/runtime APIs require bearer token except:
  - `GET /api/v1/healthz`
  - `GET /api/v1/readyz`
- Secret-bearing fields are redacted before logging.
- Audit logs exist for high-risk actions:
  - plugin import
  - proactive create/delete
  - sandbox execution

## 2. Auth Coverage Verification
Run security-focused tests:
```bash
pnpm --filter @cwork/core test -- --run test/security
```

Coverage includes:
- protected endpoint unauthorized checks
- redaction behavior checks
- audit logger structure checks

## 3. Dependency Audit
```bash
pnpm audit --audit-level high
```

Current baseline target:
- no high severity known vulnerabilities.

## 4. Hardening Recommendations
- Set a non-default `API_AUTH_TOKEN` in all non-dev environments.
- Restrict tool/plugin capabilities via:
  - `CWORK_ALLOW_TOOLS`
  - `CWORK_DENY_TOOLS`
  - `CWORK_DENY_PLUGIN_CAPS`
- Keep sandbox mode disabled unless operationally required.

## 5. Incident Response (Minimum)
1. Capture `x-request-id` from failing request.
2. Locate correlated backend log entries.
3. Check capability status endpoint for degraded components.
4. Reproduce with minimal payload.
5. Patch with smallest blast radius and rerun security checks.
