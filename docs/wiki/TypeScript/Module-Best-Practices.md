# Module Best Practices

## Quick Reference
- **When to use**: Structuring all TypeScript modules and exports
- **Enforcement**: Required - maintain clean module boundaries
- **Impact if violated**: MEDIUM - Circular dependencies, tight coupling, poor testability

## Overview

Well-structured modules improve maintainability, testability, and prevent circular dependency issues. Follow consistent export patterns and maintain clear module boundaries.

## The Rules

### 1. One Primary Export Per File

Each file should have one primary purpose and export.

### 2. Use Named Exports

Prefer named exports over default exports for better refactoring and IDE support.

### 3. Barrel Files for Public APIs

Use index.ts barrel files to expose public module APIs.

### 4. Avoid Circular Dependencies

Structure imports to prevent circular references.

## Examples

### ✅ Correct - Named Exports

```typescript
// util/transformers.ts

/**
 * Transforms snake_case keys to camelCase
 */
export function toCamelCase(obj: Record<string, any>): Record<string, any> {
  // Implementation
}

/**
 * Transforms camelCase keys to snake_case
 */
export function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  // Implementation
}

// Multiple related exports OK
```

```typescript
// Consumer
import {toCamelCase, toSnakeCase} from '../util/transformers'

const result = toCamelCase(data)
```

### ✅ Correct - Barrel File Pattern

```typescript
// lib/vendor/AWS/index.ts
export * from './S3'
export * from './Lambda'
export * from './DynamoDB'
export * from './SNS'

// Consumers can import from single location
```

```typescript
// src/lambdas/ProcessFile/src/index.ts
import {createS3Upload, invokeLambda} from '../../../lib/vendor/AWS'

// Clean imports from barrel
```

### ✅ Correct - Layered Architecture

```typescript
// util/lambda-helpers.ts - Utilities layer

export function prepareLambdaResponse(params: {
  statusCode: number
  body: any
}): ApiGatewayResponse {
  return {
    statusCode: params.statusCode,
    body: JSON.stringify(params.body),
    headers: {
      'Content-Type': 'application/json'
    }
  }
}

export function logError(error: Error, context: Record<string, any>): void {
  console.error(JSON.stringify({
    error: error.message,
    stack: error.stack,
    ...context
  }))
}
```

```typescript
// src/lambdas/GetFile/src/index.ts - Handler layer

import {prepareLambdaResponse, logError} from '../../../util/lambda-helpers'

export const handler = async (event: any) => {
  try {
    // Business logic
    return prepareLambdaResponse({statusCode: 200, body: result})
  } catch (error) {
    logError(error, {context: 'handler'})
    return prepareLambdaResponse({statusCode: 500, body: {error: 'Internal error'}})
  }
}

// Clear dependency direction: handler → util (never util → handler)
```

### ❌ Incorrect - Default Exports

```typescript
// ❌ WRONG - Default export
// util/transformers.ts
export default function toCamelCase(obj: any) {
  // Implementation
}

// Consumer - harder to refactor, no IDE help
import transform from '../util/transformers'  // What is 'transform'?
```

### ❌ Incorrect - Mixed Concerns in One File

```typescript
// ❌ WRONG - Too many unrelated exports
// util/helpers.ts

export function toCamelCase(obj: any) { /* ... */ }
export function uploadToS3(bucket: string, key: string) { /* ... */ }
export function sendEmail(to: string, body: string) { /* ... */ }
export function validateUser(userId: string) { /* ... */ }
export function parseDate(date: string) { /* ... */ }

// Should be split into:
// util/transformers.ts
// lib/vendor/AWS/S3.ts
// lib/vendor/AWS/SES.ts
// util/validation.ts
// util/date-utils.ts
```

### ❌ Incorrect - Circular Dependencies

```typescript
// ❌ WRONG - Circular dependency
// util/file-helpers.ts
import {getUserFiles} from './user-helpers'

export function processFile(fileId: string) {
  const files = getUserFiles()  // Depends on user-helpers
  // ...
}

// util/user-helpers.ts
import {processFile} from './file-helpers'  // Circular!

export function getUserFiles() {
  const file = processFile('123')  // Depends on file-helpers
  // ...
}

// ✅ CORRECT - Extract shared logic
// util/shared.ts
export function getFileById(fileId: string) { /* ... */ }

// util/file-helpers.ts
import {getFileById} from './shared'

// util/user-helpers.ts
import {getFileById} from './shared'
```

## Module Organization Patterns

### Single Responsibility Files

```typescript
// util/s3-helpers.ts - Only S3-related utilities
export function parseS3Url(url: string): {bucket: string; key: string} {
  // Implementation
}

export function buildS3Url(bucket: string, key: string): string {
  // Implementation
}
```

### Feature-Based Modules

```typescript
// src/features/download/
├── index.ts           # Public API
├── download-handler.ts
├── download-service.ts
└── download-types.ts

// src/features/download/index.ts
export {handler} from './download-handler'
export type {DownloadRequest, DownloadResponse} from './download-types'

// Internal files (service) not exported - encapsulated
```

### Shared Module Pattern

```typescript
// util/shared.ts - Utilities used by multiple modules

/**
 * Gets current timestamp in milliseconds
 */
export function now(): number {
  return Date.now()
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return `${now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Used by multiple feature modules
```

## Export Strategies

### Explicit Named Exports (Preferred)

```typescript
// util/validation.ts
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Clear what's exported
```

### Namespace Pattern for Related Functions

```typescript
// util/date-utils.ts
export const DateUtils = {
  now: (): number => Date.now(),
  
  format: (timestamp: number): string => {
    return new Date(timestamp).toISOString()
  },
  
  parse: (dateString: string): number => {
    return new Date(dateString).getTime()
  }
}

// Usage
import {DateUtils} from '../util/date-utils'
const formatted = DateUtils.format(DateUtils.now())
```

### Re-export Pattern

```typescript
// lib/vendor/AWS/index.ts
export {createS3Upload, headObject, getObject} from './S3'
export {invokeLambda} from './Lambda'
export {query, updateItem} from './DynamoDB'

// Consumers get clean single import point
import {createS3Upload, invokeLambda, query} from '../lib/vendor/AWS'
```

## Dependency Management

### Import Order

```typescript
// Group and order imports for readability

// 1. External dependencies
import {Entity} from 'electrodb'
import YTDlpWrap from 'yt-dlp-wrap'

// 2. Vendor wrappers
import {createS3Upload} from '../../../lib/vendor/AWS/S3'
import {invokeLambda} from '../../../lib/vendor/AWS/Lambda'

// 3. Internal utilities
import {prepareLambdaResponse, logError} from '../../../util/lambda-helpers'
import {validateInput} from '../../../util/constraints'

// 4. Types (use type imports)
import type {ApiGatewayEvent} from '../../../types/api'

// 5. Relative imports
import {processVideo} from './video-processor'
```

### Prevent Circular Dependencies

```typescript
// ✅ CORRECT - Unidirectional dependencies

// Layer 1: Vendor wrappers (no internal dependencies)
// lib/vendor/AWS/S3.ts - depends only on AWS SDK

// Layer 2: Utilities (depends on vendor layer)
// util/storage.ts - depends on lib/vendor/AWS/S3

// Layer 3: Services (depends on util layer)
// src/services/file-service.ts - depends on util/storage

// Layer 4: Handlers (depends on service layer)
// src/lambdas/UploadFile/src/index.ts - depends on services

// Dependency direction: Handler → Service → Util → Vendor
```

## Rationale

### Named Exports Benefits

1. **Refactoring** - IDEs can rename all usages
2. **Tree Shaking** - Bundlers can remove unused exports
3. **Clarity** - Import statements show exact dependencies
4. **Consistency** - Uniform import syntax

### Single Responsibility Benefits

1. **Testability** - Smaller, focused modules easier to test
2. **Maintainability** - Changes isolated to single module
3. **Reusability** - Focused modules more reusable
4. **Understanding** - Clear purpose per file

### Barrel Files Benefits

1. **Public API** - Clear interface to module
2. **Encapsulation** - Hide implementation details
3. **Easy Imports** - Single import location
4. **Refactoring** - Change internals without affecting consumers

## Enforcement

### Circular Dependency Check

```bash
# Install madge for dependency analysis
npm install --save-dev madge

# Check for circular dependencies
npx madge --circular --extensions ts src/
```

### Code Review Checklist

- [ ] Named exports used (no default exports)
- [ ] One primary purpose per file
- [ ] Clear module boundaries
- [ ] No circular dependencies
- [ ] Imports organized by layer
- [ ] Barrel files for public APIs
- [ ] Type imports use `import type`

### ESLint Rules

```javascript
// eslint.config.mjs
export default [
  {
    rules: {
      'import/no-default-export': 'error',
      'import/no-cycle': 'error',
      'import/order': ['error', {
        'groups': [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'always'
      }]
    }
  }
]
```

## Common Patterns

### Utility Module

```typescript
// util/string-utils.ts

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str
}

// Single purpose: string manipulation utilities
```

### Service Module

```typescript
// src/services/notification-service.ts

import {publish} from '../../lib/vendor/AWS/SNS'
import {logError} from '../../util/lambda-helpers'

/**
 * Sends push notification to device
 */
export async function sendNotification(
  deviceToken: string,
  message: string
): Promise<void> {
  try {
    await publish('NotificationTopic', {deviceToken, message})
  } catch (error) {
    logError(error, {context: 'notification', deviceToken})
    throw error
  }
}

// Single purpose: notification sending
```

### Entity Module

```typescript
// src/entities/Users.ts

import {Entity} from 'electrodb'
import {table} from '../../lib/vendor/ElectroDB/service'

export const Users = new Entity({
  model: {
    entity: 'User',
    version: '1',
    service: 'media'
  },
  attributes: {
    userId: {type: 'string', required: true},
    email: {type: 'string', required: true},
    createdAt: {type: 'number', required: true}
  },
  indexes: {
    primary: {
      pk: {field: 'pk', composite: ['userId']},
      sk: {field: 'sk', composite: []}
    }
  }
}, {table})

// Single purpose: User entity definition
```

## Related Patterns

- [Import Organization](../Conventions/Import-Organization.md) - Import order rules
- [Type Definitions](Type-Definitions.md) - Where to define types
- [Lambda Function Patterns](Lambda-Function-Patterns.md) - Handler structure

---

*Use named exports, maintain single responsibility, and organize modules in clear layers. Prevent circular dependencies through unidirectional dependency flow.*
