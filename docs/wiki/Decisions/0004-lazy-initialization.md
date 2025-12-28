# ADR-0004: Lazy Initialization for SDK Clients

## Status
Accepted

## Date
2019-07-23

## Context

ES Modules execute all module-level code when ANY export is imported. This creates a testing problem:

```typescript
// Module-level initialization - executes on import
const s3Client = new S3Client({})  // Runs before test mocks are set up

export async function uploadFile() {
  await s3Client.send(...)  // Uses real client, not mock
}
```

When tests import a module, the SDK client is already initialized with real credentials, bypassing any mocks set up in the test file.

Additionally, module-level environment variable reads fail fast before tests can configure mock values:

```typescript
// Throws immediately on import if BUCKET_NAME is missing
const BUCKET_NAME = process.env.BUCKET_NAME!

export async function uploadFile() {
  await uploadToS3(BUCKET_NAME, ...)
}
```

## Decision

Use lazy initialization for all SDK clients and environment variable reads.

### SDK Client Pattern
```typescript
let client: S3Client | null = null

function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({...})
  }
  return client
}

export async function uploadFile() {
  await getS3Client().send(...)  // Client created at call time
}
```

### Environment Variable Pattern
```typescript
// ❌ WRONG - Module-level read
const BUCKET_NAME = getRequiredEnv('BUCKET_NAME')

// ✅ CORRECT - Read inside function
export async function uploadFile() {
  const bucketName = getRequiredEnv('BUCKET_NAME')
  // ...
}
```

### Exception: AWS Powertools
Powertools initialization can use module-level env reads because:
1. All reads have fallback values (won't throw if missing)
2. Framework requires initialization at import time for tracing
3. Refactoring would require updating all handler imports

## Consequences

### Positive
- Tests can set up mocks before module code executes
- LocalStack configuration works via environment variables
- Environment can be changed between Lambda invocations (rare but possible)
- Cleaner separation of configuration from initialization

### Negative
- Slightly more verbose code
- First invocation pays initialization cost
- Developers must remember the pattern

## Enforcement

- MCP rule: `env-validation` - Catches try-catch for required env vars
- Code review: SDK clients must use getter functions
- Pattern documented in Lambda Function Patterns

## Related

- [ADR-0002: Vendor Encapsulation](0002-vendor-encapsulation.md) - Uses this pattern
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Implementation examples
- [Lambda Environment Variables](../AWS/Lambda-Environment-Variables.md) - Env var patterns
