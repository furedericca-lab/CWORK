# RELEASE CHECKLIST (v1)

## Metadata
- Release version:
- Date:
- Owner:

## 1. Scope Compliance
- [ ] Dify-only provider scope preserved.
- [ ] No messaging platform adapter introduced.
- [ ] No plugin marketplace feature introduced.

## 2. Quality Gates
- [ ] `pnpm -r lint`
- [ ] `pnpm -r typecheck`
- [ ] `pnpm -r test`
- [ ] `pnpm -r build`
- [ ] `pnpm -r e2e`

Evidence:
- CI run URL:
- Commit SHA:

## 3. Security Gates
- [ ] `pnpm audit --audit-level high`
- [ ] `pnpm --filter @cwork/core test -- --run test/security`
- [ ] API auth token is non-default for target environment.

## 4. Runtime Reliability Gates
- [ ] `pnpm perf:smoke`
- [ ] `pnpm reliability:smoke`
- [ ] `/healthz` and `/readyz` pass in target environment.

## 5. Documentation Gates
- [ ] `README.md` updated.
- [ ] `DEVELOPMENT.md` reviewed.
- [ ] `OPERATIONS.md` reviewed.
- [ ] `SECURITY.md` reviewed.
- [ ] `TROUBLESHOOTING.md` reviewed.

## 6. Deployment Gates
- [ ] Production build artifacts generated.
- [ ] Core start command validated.
- [ ] Web preview/startup validated.
- [ ] Env values checked against `.env.example`.

## 7. Sign-off
- Engineering:
- QA:
- Operations:
