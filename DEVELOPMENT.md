# DEVELOPMENT

## 1. Prerequisites
- Node.js 24+
- pnpm 10.30.3

## 2. Install
```bash
pnpm install
```

## 3. Local Development
Start both core and web:
```bash
pnpm dev
```

Start only core:
```bash
pnpm --filter @cwork/core dev
```

Start only web:
```bash
pnpm --filter @cwork/web dev
```

## 4. Local API Auth
- Default token is `dev-token`.
- Web console token input defaults to `dev-token`.
- To override:
```bash
API_AUTH_TOKEN=your_token pnpm --filter @cwork/core dev
```

## 5. Quality Gates
```bash
pnpm -r lint
pnpm -r typecheck
pnpm -r test
pnpm -r build
pnpm -r e2e
pnpm audit --audit-level high
```

## 6. Performance and Reliability Smoke
```bash
pnpm perf:smoke
pnpm reliability:smoke
```

## 7. OpenAPI Regeneration
```bash
pnpm --filter @cwork/shared gen:openapi
```

## 8. Workspace Conventions
- Keep provider scope Dify-only.
- Do not add messaging channel adapters in v1.
- Use shared contracts from `@cwork/shared` for frontend/backend type safety.
