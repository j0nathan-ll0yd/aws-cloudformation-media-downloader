# SDK Encapsulation Policy

## Quick Reference
- **When to use**: Every AWS SDK interaction
- **Enforcement**: ZERO TOLERANCE
- **Impact if violated**: CRITICAL - Breaks architecture

## The Rule

**NEVER import AWS SDK directly. Always use vendor wrappers in `lib/vendor/AWS/`.**

## Examples

### ❌ FORBIDDEN
```typescript
// Direct SDK imports
import {S3Client} from '@aws-sdk/client-s3'
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'

// Creating clients
const s3 = new S3Client()
```

### ✅ REQUIRED
```typescript
// Vendor wrapper imports
import {uploadToS3} from '../../../lib/vendor/AWS/S3'
import {queryItems} from '../../../lib/vendor/AWS/DynamoDB'
```

## Vendor Wrapper Pattern

```typescript
// lib/vendor/AWS/S3.ts
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3'
import {captureAWSClient} from './XRay'

let client: S3Client | null = null

function getS3Client(): S3Client {
  if (!client) {
    client = captureAWSClient(new S3Client({
      ...(process.env.UseLocalstack === 'true' && {
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

1. **LocalStack support** - Auto-detect environment
2. **X-Ray tracing** - Built-in instrumentation
3. **Testability** - Easy mocking
4. **Type safety** - Custom interfaces
5. **Single responsibility** - One place for SDK config

## Webpack Configuration

```javascript
// Add to externals
externals: [
  '@aws-sdk/client-s3',
  '@aws-sdk/client-dynamodb',
  // Add new SDK packages here
]
```

## Testing

```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  uploadToS3: jest.fn()
}))
```

## Verification

```bash
# Check for violations (should return nothing)
grep -r "from '@aws-sdk" src/lambdas/
grep -r "from 'aws-sdk'" src/lambdas/
```

## Related Patterns

- [X-Ray Integration](X-Ray-Integration.md)
- [LocalStack Testing](../Integration/LocalStack-Testing.md)

---

*ZERO TOLERANCE: Always use vendor wrappers for AWS SDK.*