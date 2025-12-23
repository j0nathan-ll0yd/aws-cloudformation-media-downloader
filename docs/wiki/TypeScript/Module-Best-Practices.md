# Module Best Practices

## Quick Reference
- **When to use**: Structuring TypeScript modules
- **Enforcement**: Required
- **Impact if violated**: MEDIUM - Circular dependencies

## Module Rules

1. **One primary export per file**
2. **Use named exports** (not default)
3. **Barrel files for public APIs**
4. **Avoid circular dependencies**

## Export Patterns

### ✅ Named Exports (Preferred)
```typescript
// util/transformers.ts
export function toCamelCase(obj: Record<string, any>) {}
export function toSnakeCase(obj: Record<string, any>) {}

// Usage
import {toCamelCase, toSnakeCase} from './transformers'
```

### ❌ Default Exports (Avoid)
```typescript
// Harder to refactor
export default class Processor {}
```

## Barrel Files

```typescript
// entities/index.ts
export {Files} from './Files'
export {Users} from './Users'
export {collections} from './Collections'

// Usage
import {Files, Users, collections} from '../entities'
```

## Vendor Wrapper Pattern

```typescript
// lib/vendor/AWS/S3.ts
import {S3Client} from '@aws-sdk/client-s3'

let client: S3Client | null = null

function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client()
  }
  return client
}

// Export only functions, not SDK
export function uploadToS3(bucket: string, key: string) {
  const client = getS3Client()
  // Use client
}
```

## Lazy Initialization

```typescript
let expensive: Resource | null = null

export function getResource(): Resource {
  if (!expensive) {
    expensive = createExpensive()
  }
  return expensive
}
```

## Type-Only Imports

```typescript
// Prefer type imports when possible
import type {FileData} from '../types/main'
import {processFile} from '../processors'
```

## Best Practices

✅ Named exports only
✅ One concern per module
✅ Vendor wrappers for external libs
✅ Lazy init expensive resources
✅ Type-only imports when possible
✅ Clear module boundaries

## ESM Compatibility

This project uses pure ESM for Lambda functions. When working with CommonJS dependencies:

1. **Most CJS packages work automatically** via the `createRequire` shim
2. **Use dynamic imports** for problematic packages: `await import('pkg')`
3. **Use `import type`** for type-only imports from CJS packages
4. **Create pnpm patches** for packages with Node.js built-in requires

See [ESM Migration Guide](ESM-Migration-Guide.md) for comprehensive documentation.

## Related Patterns

- [ESM Migration Guide](ESM-Migration-Guide.md) - CJS compatibility strategies
- [Import Organization](../Conventions/Import-Organization.md)
- [Type Definitions](Type-Definitions.md)
- [Lambda Function Patterns](Lambda-Function-Patterns.md)

---

*Use named exports and maintain clear module boundaries.*