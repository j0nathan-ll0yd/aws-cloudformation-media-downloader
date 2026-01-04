# Code Organization

This document describes the project's code organization principles and enforcement rules.

## Directory Structure

```
src/
├── config/           # Build and runtime configuration
├── entities/         # Entity query functions (Drizzle ORM with Aurora DSQL)
├── lambdas/          # Lambda function handlers (one per directory)
├── lib/              # Shared library code
│   ├── data/         # Data utilities (pagination, retry)
│   ├── domain/       # Pure business logic (infrastructure-agnostic)
│   ├── integrations/ # External service integrations
│   ├── lambda/       # Lambda middleware and utilities
│   ├── system/       # System utilities (env, errors, logging)
│   └── vendor/       # Third-party API wrappers
├── mcp/              # Model Context Protocol server
└── types/            # TypeScript type definitions
```

## No Orphaned Library Code

All modules in `src/lib/` must be imported by at least one production file.

### Why This Matters

- Prevents dead code accumulation
- Reduces bundle sizes
- Keeps codebase maintainable
- Ensures all code serves a purpose

### Exceptions

The following are allowed to exist without imports:
- Test files (`*.test.ts`)
- Type definition files (`*.d.ts`)
- Index files that re-export
- Entry points (Lambda handlers)

### Enforcement

| Method | Severity | Rule |
|--------|----------|------|
| Dependency Cruiser | ERROR | `no-orphans-lib` |

### Configuration

```javascript
// .dependency-cruiser.cjs
{
  name: 'no-orphans-lib',
  severity: 'error',
  from: {
    path: '^src/lib/',
    pathNot: ['\\.test\\.ts$', '\\.d\\.ts$', 'index\\.ts$']
  },
  to: {
    reachable: false
  }
}
```

### Finding Orphans

```bash
# Check for orphaned files
pnpm deps:check

# The dependency cruiser will report:
# warn no-orphans: src/lib/unused-module.ts
```

### Resolving Orphans

When an orphan is detected:

1. **If intentionally unused**: Delete the file
2. **If should be used**: Add appropriate import
3. **If utility for future use**: Move to tests or delete (YAGNI)

## Import Boundaries

### Lambda Isolation

Lambda functions cannot import from other Lambdas:

```typescript
// src/lambdas/StartFileUpload/src/index.ts
import {handler} from '#lambdas/FileCoordinator'  // VIOLATION!
```

### Entity Independence

Entity definitions cannot import from other entities:

```typescript
// src/entities/Users.ts
import {Files} from './Files'  // VIOLATION!
```

Use Collections for cross-entity queries instead.

### Domain Purity

Domain code cannot import infrastructure. See [Domain Layer](./Domain-Layer.md).

## Enforcement Summary

| Rule | Scope | Enforcement |
|------|-------|-------------|
| No orphaned lib code | `src/lib/**` | Dependency Cruiser |
| No cross-lambda imports | `src/lambdas/**` | Dependency Cruiser |
| No entity cross-deps | `src/entities/**` | Dependency Cruiser |
| Domain purity | `src/lib/domain/**` | ESLint + Dep Cruiser |
| No circular deps | All | Dependency Cruiser |

## Running Checks

```bash
# Full dependency analysis
pnpm deps:check

# Pre-commit (runs automatically)
# Dependency checks run on every commit via Husky
```
