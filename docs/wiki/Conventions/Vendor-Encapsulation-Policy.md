# Vendor Encapsulation Policy

## Quick Reference
- **When to use**: Every third-party library interaction
- **Enforcement**: ZERO TOLERANCE
- **Impact if violated**: CRITICAL - Breaks architecture

## The Rule

**NEVER import third-party libraries directly in Lambda handlers or business logic. Always use vendor wrappers in `src/lib/vendor/`.**

This applies to:
- AWS SDK (`@aws-sdk/*`)
- Drizzle ORM
- Better Auth
- yt-dlp (YouTube)
- Any other third-party service integration

## Vendor Wrapper Locations

| Library | Wrapper Location | Purpose |
|---------|------------------|---------|
| AWS SDK | `src/lib/vendor/AWS/` | S3, DynamoDB, SNS, SQS, Lambda |
| Drizzle ORM | `src/lib/vendor/Drizzle/` | Aurora DSQL database access |
| Better Auth | `src/lib/vendor/BetterAuth/` | Authentication framework |
| yt-dlp | `src/lib/vendor/YouTube.ts` | Video download wrapper |

## Examples

### AWS SDK

#### ❌ FORBIDDEN
```typescript
// Direct SDK imports
import {S3Client} from '@aws-sdk/client-s3'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'

// Creating clients
const s3 = new S3Client()
```

#### ✅ REQUIRED
```typescript
// Vendor wrapper imports
import {uploadToS3} from '#lib/vendor/AWS/S3'
import {queryItems} from '#lib/vendor/AWS/DynamoDB'
```

### Drizzle ORM

#### ❌ FORBIDDEN
```typescript
// Direct Drizzle imports in Lambda handlers
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
```

#### ✅ REQUIRED
```typescript
// Use entity query functions from vendor wrapper
import {getFileById} from '#entities/queries'
const file = await getFileById(fileId)
```

### Better Auth

#### ❌ FORBIDDEN
```typescript
// Direct Better Auth usage
import {betterAuth} from 'better-auth'
const auth = betterAuth({...})
```

#### ✅ REQUIRED
```typescript
// Use configured auth instance
import {auth} from '#lib/vendor/BetterAuth'
const session = await auth.api.getSession({...})
```

### Drizzle ORM

#### ❌ FORBIDDEN
```typescript
// Direct Drizzle imports
import {drizzle} from 'drizzle-orm/postgres-js'
import {eq} from 'drizzle-orm'
import postgres from 'postgres'
```

#### ✅ REQUIRED
```typescript
// Client: Use configured client with IAM auth
import {getDrizzleClient} from '#lib/vendor/Drizzle'

// Schema: Import table definitions
import {users, files} from '#lib/vendor/Drizzle/schema'

// Types: Import query operators
import {eq, and} from '#lib/vendor/Drizzle/types'

// FK checks: Import foreign key enforcement
import {assertUserExists} from '#lib/vendor/Drizzle/fkEnforcement'
```

#### Type Utilities

The `#lib/vendor/Drizzle/types` module provides type inference utilities:

```typescript
import type {SelectModel, InsertModel, UpdateModel} from '#lib/vendor/Drizzle/types'
import {users} from '#lib/vendor/Drizzle/schema'

// Infer the select (read) model type from a Drizzle table
type UserItem = SelectModel<typeof users>

// Infer the insert (create) model type from a Drizzle table
type CreateUserInput = InsertModel<typeof users>

// Create a partial update type, excluding the primary key
type UpdateUserInput = Partial<Omit<InsertModel<typeof users>, 'userId'>>
```

## Vendor Wrapper Pattern

```typescript
// src/lib/vendor/AWS/S3.ts
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
import {captureAWSClient} from './XRay'

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

export async function uploadToS3(
  bucket: string,
  key: string,
  body: Buffer
): Promise<void> {
  const client = getS3Client()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body
  }))
}
```

## Why Vendor Wrappers?

1. **Environment Detection** - Auto-detect LocalStack vs production
2. **Instrumentation** - Built-in X-Ray tracing for AWS services
3. **Testability** - Single mock point per service
4. **Type Safety** - Custom interfaces with domain semantics
5. **Configuration** - Centralized client configuration
6. **Consistency** - Same patterns across all integrations

## Enforcement

| Method | Scope |
|--------|-------|
| MCP Rule `aws-sdk-encapsulation` | AWS SDK imports |
| ESLint `no-direct-aws-sdk-import` | AWS SDK imports |
| Dependency Cruiser | Cross-module boundaries |
| Code Review | All vendor libraries |

## Testing

```typescript
// Mock the vendor wrapper, not the SDK
jest.unstable_mockModule('#lib/vendor/AWS/S3', () => ({
  uploadToS3: jest.fn()
}))
```

## Adding New Vendors

1. Create wrapper in `src/lib/vendor/{VendorName}/`
2. Implement lazy initialization pattern
3. Add environment detection if needed
4. Add X-Ray instrumentation for AWS services
5. Export domain-specific functions
6. Update this documentation

## Related Patterns

- [X-Ray Integration](../AWS/X-Ray-Integration.md) - AWS service tracing
- [LocalStack Testing](../Integration/LocalStack-Testing.md) - Local development
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Entity mocking patterns

---

*ZERO TOLERANCE: Always use vendor wrappers for third-party libraries.*
