# Domain Layer Purity

> **Status**: This is an architectural guideline for future development. The `src/lib/domain/` directory will be created as business logic is extracted from Lambda handlers.

The domain layer (`src/lib/domain/`) contains pure business logic that must remain infrastructure-agnostic.

## Architecture Rule

Files in `src/lib/domain/` **cannot** import from:
- `src/lambdas/` - Lambda handlers are infrastructure concerns
- `src/lib/vendor/AWS/` - AWS SDK wrappers are infrastructure concerns

## Why This Matters

1. **Testability**: Domain logic can be unit tested without mocking AWS services
2. **Portability**: Business rules aren't coupled to AWS implementation details
3. **Clarity**: Clear separation between "what the system does" (domain) and "how it's deployed" (infrastructure)
4. **Maintainability**: Changes to AWS SDK or Lambda patterns don't ripple into business logic

## Domain Layer Contents

```
src/lib/domain/
├── device/           # Device management logic
│   └── deviceService.ts
├── notification/     # Notification formatting and transformation
│   └── transformers.ts
├── user/             # User management logic
│   └── userFileService.ts
└── video/            # Video processing logic
    └── errorClassifier.ts
```

## What CAN Be Imported

Domain modules may import:
- Other domain modules (`src/lib/domain/`)
- Type definitions (`src/types/`)
- Entity definitions for types only (`src/entities/` - type imports)
- Pure utility functions (`src/lib/system/`, `src/lib/data/`)

## Enforcement

| Method | Severity | Rule |
|--------|----------|------|
| ESLint | HIGH | `local-rules/no-domain-leakage` |
| Dependency Cruiser | ERROR | `no-domain-leakage` |

### ESLint Rule Configuration

```javascript
// eslint-local-rules/no-domain-leakage.cjs
module.exports = {
  meta: {
    type: 'problem',
    docs: {description: 'Prevent domain layer from importing infrastructure code'}
  },
  create(context) {
    const filePath = context.getFilename()
    if (!filePath.includes('src/lib/domain/')) return {}

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (source.includes('src/lambdas/') || source.includes('lib/vendor/AWS/')) {
          context.report({
            node,
            message: 'Domain layer cannot import from infrastructure (lambdas or AWS vendor)'
          })
        }
      }
    }
  }
}
```

## Examples

### Correct Pattern

```typescript
// src/lib/domain/video/errorClassifier.ts
import type {YtDlpVideoInfo} from '#types/youtube'

export function classifyVideoError(error: Error, info?: YtDlpVideoInfo) {
  // Pure business logic - no AWS dependencies
  if (error.message.includes('Sign in to confirm')) {
    return {category: 'authentication_required', retryable: true}
  }
  // ...
}
```

### Incorrect Pattern

```typescript
// src/lib/domain/video/errorClassifier.ts
import {invokeLambda} from '#lib/vendor/AWS/Lambda'  // VIOLATION!

export function classifyVideoError(error: Error) {
  // This creates infrastructure coupling
  await invokeLambda('NotifyAdmin', {error})  // WRONG
}
```

## Migration Path

If domain code currently imports infrastructure:

1. Extract the infrastructure call to a callback/interface
2. Pass the callback from the Lambda handler
3. Update tests to provide mock callbacks

```typescript
// Before (violation)
import {sendNotification} from '#lib/vendor/AWS/SNS'
export function processUser(user: User) {
  sendNotification(user.email, 'Welcome!')
}

// After (correct)
export function processUser(user: User, notify: (email: string, msg: string) => void) {
  notify(user.email, 'Welcome!')
}
```

---

## Candidates for Domain Extraction

When business logic is currently embedded in Lambda handlers, consider extracting to the domain layer:

### Good Candidates

| Current Location | Extraction Target | Why Domain |
|-----------------|-------------------|------------|
| Video URL validation | `domain/video/validators.ts` | Pure string logic, no AWS |
| Error classification | `domain/video/errorClassifier.ts` | Pure pattern matching |
| Notification formatting | `domain/notification/formatters.ts` | Pure data transformation |
| Rate limit calculation | `domain/user/rate-limits.ts` | Pure arithmetic |
| File status transitions | `domain/file/state-machine.ts` | Pure state logic |

### Not Candidates

| Logic | Why Not Domain |
|-------|---------------|
| S3 upload orchestration | Requires AWS SDK |
| DynamoDB queries | Requires AWS SDK |
| APNS notification sending | Requires external service |
| SQS message publishing | Requires AWS SDK |

### Extraction Checklist

When extracting business logic:

1. **Identify pure functions** - No side effects, no I/O
2. **Extract to domain module** - Create file in `src/lib/domain/`
3. **Define interfaces for callbacks** - Any I/O becomes a callback parameter
4. **Update Lambda handler** - Pass concrete implementations
5. **Write unit tests** - No mocking required for pure domain logic

---

## Benefits in Practice

### Testability Example

```typescript
// Domain layer (pure, easy to test)
export function shouldRetryDownload(error: Error, attemptCount: number): boolean {
  if (attemptCount >= 3) return false
  if (error.message.includes('cookie')) return false
  return error.message.includes('timeout') || error.message.includes('network')
}

// Test (no mocks needed!)
describe('shouldRetryDownload', () => {
  it('returns false after 3 attempts', () => {
    expect(shouldRetryDownload(new Error('timeout'), 3)).toBe(false)
  })

  it('returns true for network errors', () => {
    expect(shouldRetryDownload(new Error('network failure'), 1)).toBe(true)
  })
})
```

### Portability Example

```typescript
// Domain layer works anywhere
import {formatPushPayload} from '#lib/domain/notification/formatters'

// Works in Lambda
const apnsPayload = formatPushPayload({title: 'Download Complete', fileId: '123'})
await sendApns(apnsPayload)

// Works in CLI tool
const payload = formatPushPayload({title: 'Test', fileId: 'test'})
console.log(JSON.stringify(payload, null, 2))

// Works in tests
expect(formatPushPayload({title: 'X', fileId: 'Y'})).toEqual({...})
```

---

## Related Documentation

- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler structure
- [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) - Import rules
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Testing patterns
