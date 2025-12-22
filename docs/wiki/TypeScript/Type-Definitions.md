# Type Definitions

## Quick Reference
- **When to use**: Defining TypeScript types and interfaces
- **Enforcement**: Required - MCP `types-location` rule validates on push
- **Impact if violated**: HIGH - Type sprawl, duplication, poor IDE experience

## Exported Type Location (HIGH Priority)

**Rule**: All exported type definitions (type aliases, interfaces, enums) must be in the `src/types/` directory.

**Why**: Separation of concerns, discoverability, and maintainability. Types scattered across implementation files are hard to find and lead to duplication.

**Enforcement**: MCP `types-location` rule (HIGH severity) detects violations in CI.

### Allowed Exceptions

| Location | Reason |
|----------|--------|
| `src/types/**/*.ts` | Canonical location for types |
| `src/entities/**/*.ts` | Entity-derived types from ElectroDB |
| `src/mcp/**/*.ts` | Self-contained MCP module |
| `**/*.test.ts`, `test/**/*.ts` | Test-only types |
| `src/lib/vendor/**/*.ts` | Internal vendor wrapper types |

### Type File Organization

```
src/types/
├── domain-models.ts     # Core domain types (User, Device, etc.)
├── persistence-types.ts # Relationship types (UserDevice, UserFile)
├── enums.ts             # Shared enumerations
├── lambda-wrappers.ts   # Lambda handler wrapper types
├── video.ts             # Video processing types
├── util.ts              # Utility function types
├── youtube.ts           # YouTube/yt-dlp types
└── vendor/              # Third-party integration types
    └── IFTTT/
```

### Examples

```typescript
// ✅ CORRECT - Export from src/types/
// src/types/lambda-wrappers.ts
export type WrapperMetadata = {traceId: string}
export type ApiHandlerParams<TEvent> = {event: TEvent; context: Context; metadata: WrapperMetadata}

// ✅ CORRECT - Import from types directory
// src/lambdas/ListFiles/src/index.ts
import type {ApiHandlerParams} from '#types/lambda'

// ❌ WRONG - Exporting type from implementation file
// src/util/helpers.ts
export type HelperConfig = {maxRetries: number}  // Should be in src/types/util.ts
```

## The Rules

1. **Exported Types in `types/` Directory** - All exported types must be in `src/types/`
2. **Inline Types for Single-Use Cases** - Define internal (non-exported) types inline
3. **Entity Types with Entities** - ElectroDB entity types stay with entity definitions
4. **Use `import type` Syntax** - Better tree-shaking and clearer intent

## Examples

### ✅ Correct - Inline Types

```typescript
// src/lambdas/ProcessVideo/src/index.ts

// Small, single-use type - defined inline
interface VideoMetadata {
  title: string
  duration: number
  format: string
}

export const handler = async (event: any) => {
  const metadata: VideoMetadata = extractMetadata(event)
  // Use metadata
}
```

### ✅ Correct - Shared Types in types/

```typescript
// types/api.ts - Shared API types
export interface ApiGatewayEvent {
  body: string
  headers: Record<string, string>
  pathParameters: Record<string, string>
}

export interface ApiGatewayResponse {
  statusCode: number
  headers?: Record<string, string>
  body: string
}

// Used across multiple Lambda functions
```

### ❌ Incorrect - Type Sprawl

```typescript
// ❌ WRONG - Separate file for one type used once
// types/VideoMetadata.ts
export interface VideoMetadata {
  title: string
  duration: number
}

// Only used in one place - should be inline
```

### ❌ Incorrect - Duplicated Types

```typescript
// ❌ WRONG - Same type defined in multiple files
// src/lambdas/ListFiles/src/index.ts
interface ApiResponse {
  statusCode: number
  body: string
}

// src/lambdas/GetFile/src/index.ts
interface ApiResponse {  // Duplicate!
  statusCode: number
  body: string
}

// Should be shared in types/api.ts
```

## Type Organization Structure

```
types/
├── api.ts              # API Gateway types
├── domain.ts           # Domain models (User, File, Device)
├── events.ts           # AWS event types (SNS, SQS)
├── errors.ts           # Error types
└── validation.ts       # Validation constraint types

src/
├── entities/
│   ├── Files.ts        # File entity with types
│   ├── Users.ts        # User entity with types
│   └── Devices.ts      # Device entity with types
├── lambdas/
│   └── [Function]/
│       └── src/
│           └── index.ts  # Inline types for single-use
```

## When to Create Shared Types

Create types in `types/` directory when:

1. **Used in 3+ files** - Clear reuse pattern
2. **Cross-cutting concern** - API contracts, domain models
3. **External contract** - Types exposed to consumers
4. **Complex type** - Large types that clutter implementation files

Keep types inline when:

1. **Single use** - Only needed in one file
2. **Small** - 3-4 properties or less
3. **Implementation detail** - Not part of public API
4. **Tightly coupled** - Specific to one function's logic

## Type Naming Conventions

```typescript
// Interfaces use PascalCase
interface UserProfile {
  userId: string
  email: string
}

// Type aliases use PascalCase
type FileStatus = 'Queued' | 'Downloading' | 'Downloaded' | 'Failed'

// Generic type parameters use single uppercase letter
function map<T, R>(items: T[], fn: (item: T) => R): R[] {
  return items.map(fn)
}

// Avoid prefixing with 'I' or 'T'
// ❌ WRONG
interface IUser {}
type TFileStatus = string

// ✅ CORRECT
interface User {}
type FileStatus = string
```

## Type Imports

```typescript
// Use 'type' keyword for type-only imports (better tree-shaking)
import type {ApiGatewayEvent} from '../../../types/api'
import type {User} from '../../../types/domain'

// Regular import for values (functions, classes, enums)
import {validateInput} from '../../../util/constraints'
```

## Lambda-Specific Types

Lambda functions may have types used only within that lambda. The rule for organizing these types follows a threshold-based approach.

### When to Create a types/ Directory

Create a `src/lambdas/[name]/types/` directory when ANY of these apply:

1. **3+ types** specific to that lambda
2. **Re-exported types** - Types exported from the handler for external consumers
3. **Complex types** - Types with 5+ properties or nested structures count as 2

### When to Use Inline Types

Define types inline in the handler when ALL of these apply:

1. **1-2 simple types** only
2. **Not re-exported** - Types are internal to the lambda
3. **Small types** - 4 or fewer properties, no nested structures

### Examples

```typescript
// ✅ Keep types/ directory (3+ types)
// CloudfrontMiddleware has 3 CloudFront-related types
src/lambdas/CloudfrontMiddleware/types/index.ts

// ✅ Keep types/ directory (re-exported)
// PruneDevices re-exports PruneDevicesResult for callers
src/lambdas/PruneDevices/types/index.ts
export type {PruneDevicesResult} from '../types'  // in handler

// ✅ Inline types (1 simple type, not re-exported)
// FileCoordinator's DownloadInfo is only used internally
interface DownloadInfo {
  fileId: string
  correlationId?: string
}
```

### Current Lambda Type Organization

| Lambda | Types | Location | Reason |
|--------|-------|----------|--------|
| CloudfrontMiddleware | 3 | `types/` | 3+ types threshold |
| PruneDevices | 2 | `types/` | Re-exported for callers |
| FileCoordinator | 1 | Inline | Single simple type |
| LoginUser | 1 | Inline | Single simple type |
| RegisterDevice | 1 | Inline | Single simple type |
| RegisterUser | 1 | Inline | Single simple type |
| StartFileUpload | 1 | Inline | Single simple type |
| UserSubscribe | 1 | Inline | Single simple type |

## Enforcement

### Code Review Checklist

- [ ] Shared types in `types/` directory
- [ ] Single-use types defined inline
- [ ] No type-only files for trivial types
- [ ] Entity types stay with entity definitions
- [ ] No AWS SDK types in public APIs
- [ ] Type imports use `import type` keyword
- [ ] Type names follow PascalCase convention
- [ ] Lambda types follow 3+ threshold or re-export rule

## Related Patterns

- [Naming Conventions](../Conventions/Naming-Conventions.md) - PascalCase for types
- [Import Organization](../Conventions/Import-Organization.md) - Type import order

---

*Organize types based on usage. Inline for single-use, shared directory for cross-cutting types. Keep entity types with entities.*
