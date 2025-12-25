# Domain Layer Purity

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
│   └── device-service.ts
├── notification/     # Notification formatting and transformation
│   └── transformers.ts
├── user/             # User management logic
│   └── user-file-service.ts
└── video/            # Video processing logic
    └── error-classifier.ts
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
// src/lib/domain/video/error-classifier.ts
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
// src/lib/domain/video/error-classifier.ts
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
