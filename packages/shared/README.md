# @cwork/shared

Shared contract package for `apps/core` and `apps/web`.

## Contents
- TypeScript contract types (`src/contracts`)
- Zod runtime validators (`src/schema`)
- Generated OpenAPI artifacts (`src/generated`)

## Contract Generation
```bash
pnpm --filter @cwork/shared gen:openapi
```

## Quality Commands
```bash
pnpm --filter @cwork/shared lint
pnpm --filter @cwork/shared typecheck
pnpm --filter @cwork/shared test
pnpm --filter @cwork/shared build
```
