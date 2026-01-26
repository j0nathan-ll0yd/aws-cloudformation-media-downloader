# ADR-0002: Vendor Library Encapsulation

## Status
Accepted

## Date
2019-07-23

## Context

When building AWS Lambda functions, we face several challenges with direct AWS SDK usage:

1. **Testing Complexity**: Direct SDK imports execute at module load time, before test mocks can be configured
2. **Environment Flexibility**: Need to switch between production AWS and LocalStack for local development
3. **Observability**: X-Ray tracing requires wrapping SDK clients
4. **Consistency**: Multiple developers importing SDKs differently leads to inconsistent patterns
5. **Coupling**: Business logic becomes tightly coupled to specific SDK implementations

The original pattern of importing `@aws-sdk/client-s3` directly in Lambda handlers made testing difficult and created maintenance challenges.

## Decision

All third-party library imports must go through vendor wrapper modules in `src/lib/vendor/`.

### Scope
This applies to:
- AWS SDK (`@aws-sdk/*`)
- ElectroDB (DynamoDB ORM)
- Better Auth (authentication)
- yt-dlp (YouTube downloads)
- Any new third-party service integrations

### Pattern
Vendor wrappers implement lazy initialization with singleton clients:

```typescript
// lib/vendor/AWS/S3.ts
let client: S3Client | null = null

function getS3Client(): S3Client {
  if (!client) {
    client = captureAWSClient(new S3Client({
      ...(process.env.USE_LOCALSTACK === 'true' && {
        endpoint: 'http://localhost:4566'
      })
    }))
  }
  return client
}

export async function uploadToS3(bucket: string, key: string, body: Buffer): Promise<void> {
  await getS3Client().send(new PutObjectCommand({...}))
}
```

### Enforcement
- ZERO TOLERANCE policy
- MCP rule: `aws-sdk-encapsulation`
- ESLint rule: `no-direct-aws-sdk-import`
- Dependency Cruiser: Cross-module boundary checks

## Consequences

### Positive
- **Environment Detection**: Auto-detect LocalStack vs production
- **Instrumentation**: Built-in X-Ray tracing for all AWS services
- **Testability**: Single mock point per service
- **Type Safety**: Custom interfaces with domain semantics
- **Configuration**: Centralized client configuration
- **Consistency**: Same patterns across all integrations

### Negative
- Additional abstraction layer
- Must update vendor wrapper when using new SDK features
- Onboarding requires understanding the pattern

## Enforcement

| Method | Scope |
|--------|-------|
| MCP Rule `aws-sdk-encapsulation` | AWS SDK imports |
| ESLint `no-direct-aws-sdk-import` | AWS SDK imports |
| Dependency Cruiser | Cross-module boundaries |
| Code Review | All vendor libraries |

## Related

- [Vendor Encapsulation Policy](../Conventions/Vendor-Encapsulation-Policy.md) - Implementation guide
- [ADR-0004: Lazy Initialization](0004-lazy-initialization.md) - Related pattern
- [LocalStack Testing](../Testing/LocalStack-Testing.md) - Local development
