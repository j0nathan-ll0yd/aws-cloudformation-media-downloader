# Type Definitions

## Quick Reference
- **When to use**: Defining TypeScript types and interfaces
- **Enforcement**: Required - maintain type safety and organization
- **Impact if violated**: MEDIUM - Type sprawl, duplication, poor IDE experience

## The Rules

1. **Inline Types for Single-Use Cases** - Define types inline when only used within a single file
2. **Shared Types in `types/` Directory** - Move types to `types/` when used across multiple files
3. **Entity Types with Entities** - ElectroDB entity types stay with entity definitions
4. **Avoid Type-Only Files Unless Necessary** - Don't create files that only export types unless shared across many modules

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
type FileStatus = 'pending' | 'complete' | 'failed'

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

## Enforcement

### Code Review Checklist

- [ ] Shared types in `types/` directory
- [ ] Single-use types defined inline
- [ ] No type-only files for trivial types
- [ ] Entity types stay with entity definitions
- [ ] No AWS SDK types in public APIs
- [ ] Type imports use `import type` keyword
- [ ] Type names follow PascalCase convention

## Related Patterns

- [Naming Conventions](../Conventions/Naming-Conventions.md) - PascalCase for types
- [Import Organization](../Conventions/Import-Organization.md) - Type import order

---

*Organize types based on usage. Inline for single-use, shared directory for cross-cutting types. Keep entity types with entities.*
