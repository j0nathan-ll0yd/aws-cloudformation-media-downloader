# Type Definitions

## Quick Reference
- **When to use**: Defining TypeScript types and interfaces
- **Enforcement**: Required - maintain type safety and organization
- **Impact if violated**: MEDIUM - Type sprawl, duplication, poor IDE experience

## Overview

TypeScript types should be organized based on their scope and usage. Inline types for small, single-use cases. Shared types in `types/` directory for cross-cutting concerns.

## The Rules

### 1. Inline Types for Single-Use Cases

Define types inline when they're only used within a single file.

### 2. Shared Types in `types/` Directory

Move types to `types/` when used across multiple files.

### 3. Entity Types with Entities

ElectroDB entity types stay with entity definitions.

### 4. Avoid Type-Only Files Unless Necessary

Don't create files that only export types unless they're shared across many modules.

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
  queryStringParameters: Record<string, string>
}

export interface ApiGatewayResponse {
  statusCode: number
  headers?: Record<string, string>
  body: string
}

// Used across multiple Lambda functions
```

```typescript
// src/lambdas/ListFiles/src/index.ts
import type {ApiGatewayEvent, ApiGatewayResponse} from '../../../types/api'

export const handler = async (event: ApiGatewayEvent): Promise<ApiGatewayResponse> => {
  // Implementation
}
```

### ✅ Correct - Entity Types

```typescript
// src/entities/Files.ts

// Entity type defined with entity
interface FileAttributes {
  fileId: string
  userId: string
  url: string
  status: FileStatus
  createdAt: number
}

export type FileStatus = 'pending' | 'downloading' | 'complete' | 'failed'

export const Files = new Entity({
  model: {
    entity: 'File',
    version: '1',
    service: 'media'
  },
  attributes: {
    fileId: {type: 'string', required: true},
    userId: {type: 'string', required: true},
    url: {type: 'string', required: true},
    status: {type: FileStatus as any, required: true},
    createdAt: {type: 'number', required: true}
  }
  // ...
})
```

### ✅ Correct - Utility Function Types

```typescript
// util/transformers.ts

// Types specific to this utility module
export type TransformFn<T, R> = (input: T) => R

export function transform<T, R>(
  data: T,
  transformFn: TransformFn<T, R>
): R {
  return transformFn(data)
}
```

### ❌ Incorrect - Type Sprawl

```typescript
// ❌ WRONG - Separate file for one type used once
// types/VideoMetadata.ts
export interface VideoMetadata {
  title: string
  duration: number
}

// src/lambdas/ProcessVideo/src/index.ts
import type {VideoMetadata} from '../../../types/VideoMetadata'
// Only used here - should be inline
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

### ❌ Incorrect - Mixing Concerns

```typescript
// ❌ WRONG - AWS SDK types exposed
// types/s3.ts
import type {PutObjectCommandInput} from '@aws-sdk/client-s3'

export type S3UploadParams = PutObjectCommandInput  // Leaking AWS SDK types!

// ✅ CORRECT - Use simple types
// types/storage.ts
export interface UploadParams {
  bucket: string
  key: string
  body: Buffer | string
  contentType: string
}
```

## Type Organization Structure

```
types/
├── api.ts              # API Gateway types
├── domain.ts           # Domain models (User, File, Device)
├── events.ts           # AWS event types (SNS, SQS, etc.)
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
└── util/
    ├── transformers.ts   # Inline utility types
    └── lambda-helpers.ts # Inline helper types
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
import {UserStatus} from '../../../types/domain'  // If UserStatus is an enum
```

## Rationale

### Organization Benefits

1. **Discoverability** - Shared types easy to find in `types/`
2. **Maintainability** - Update types in one place
3. **Avoid Duplication** - Single source of truth for shared types
4. **Clear Ownership** - Inline types belong to their file

### Performance Benefits

1. **Smaller Bundles** - Type-only imports don't add runtime code
2. **Faster Compilation** - TypeScript compiles faster with organized types
3. **Better Tree-Shaking** - Type imports removed in production builds

## Enforcement

### File Organization Check

```bash
# Check for orphaned type files (files with only types)
find types/ -name "*.ts" -exec grep -L "export.*function\|export.*const\|export.*class" {} \;

# Look for potential shared types (used in multiple files)
for type in $(grep -rho "interface [A-Z][a-zA-Z]*" src/ | cut -d' ' -f2 | sort | uniq -c | sort -rn | awk '$1 > 2 {print $2}'); do
  echo "Type $type used multiple times - consider moving to types/"
done
```

### Code Review Checklist

- [ ] Shared types in `types/` directory
- [ ] Single-use types defined inline
- [ ] No type-only files for trivial types
- [ ] Entity types stay with entity definitions
- [ ] No AWS SDK types in public APIs
- [ ] Type imports use `import type` keyword
- [ ] Type names follow PascalCase convention

## Common Patterns

### Domain Models

```typescript
// types/domain.ts
export interface User {
  userId: string
  email: string
  createdAt: number
  updatedAt: number
}

export interface File {
  fileId: string
  userId: string
  url: string
  status: FileStatus
  createdAt: number
}

export type FileStatus = 'pending' | 'downloading' | 'complete' | 'failed'
```

### API Contracts

```typescript
// types/api.ts
export interface ListFilesRequest {
  userId: string
  limit?: number
  cursor?: string
}

export interface ListFilesResponse {
  files: File[]
  nextCursor?: string
}

export interface ErrorResponse {
  error: string
  details?: Record<string, any>
}
```

### Utility Types

```typescript
// types/util.ts
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
```

## Migration Strategy

If types are scattered across files:

1. **Identify shared types** - Find types used in multiple files
2. **Extract to types/** - Move to appropriate type file
3. **Update imports** - Change to type imports
4. **Remove duplicates** - Delete duplicate definitions
5. **Test** - Ensure TypeScript compilation succeeds

## Related Patterns

- [Naming Conventions](../Conventions/Naming-Conventions.md) - PascalCase for types
- [Import Organization](../Conventions/Import-Organization.md) - Type import order
- [Module Best Practices](Module-Best-Practices.md) - Export patterns

---

*Organize types based on usage. Inline for single-use, shared directory for cross-cutting types. Keep entity types with entities.*
