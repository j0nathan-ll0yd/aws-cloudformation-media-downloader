# Lazy Initialization Pattern

## Quick Reference
- **When to use**: Modules that create AWS SDK clients or external connections at module level
- **Enforcement**: Required - prevents test failures from premature initialization
- **Impact if violated**: HIGH - Tests fail with SDK errors despite mocking

## The Problem

AWS SDK clients and external connections initialized at module level execute immediately when the module loads, **before** mocks are set up.

## Core Pattern

### ❌ Incorrect - Eager Initialization
```typescript
// ❌ WRONG - Client created at module level
import {S3Client} from '@aws-sdk/client-s3'

const s3Client = new S3Client({region: 'us-west-2'})  // Runs immediately!

export async function headObject(bucket: string, key: string) {
  return await s3Client.send(command)  // Too late to mock
}
```

### ✅ Correct - Lazy Initialization
```typescript
// ✅ Client is null initially
let s3Client: S3Client | null = null

// ✅ Initialize only when first used
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({region: process.env.AWS_REGION || 'us-west-2'})
  }
  return s3Client
}

export async function headObject(bucket: string, key: string) {
  const client = getS3Client()  // Created on first call
  return await client.send(new HeadObjectCommand({Bucket: bucket, Key: key}))
}

export function resetS3Client(): void {
  s3Client = null
}
```

## Common Implementations

### With X-Ray Integration
```typescript
import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb'
import {captureAWSClient} from './XRay'

let dynamoClient: DynamoDBDocumentClient | null = null

function getDynamoClient(): DynamoDBDocumentClient {
  if (!dynamoClient) {
    const client = new DynamoDBClient({region: process.env.AWS_REGION || 'us-west-2'})
    dynamoClient = DynamoDBDocumentClient.from(captureAWSClient(client))
  }
  return dynamoClient
}

export async function query(tableName: string, key: string, value: string) {
  const client = getDynamoClient()
  // Use client...
}

export function resetDynamoClient(): void {
  dynamoClient = null
}
```

### With LocalStack Configuration
```typescript
let s3Client: S3Client | null = null

interface S3Config {
  region?: string
  endpoint?: string
  forcePathStyle?: boolean
}

function getS3Client(config?: S3Config): S3Client {
  if (!s3Client) {
    const isLocalStack = process.env.USE_LOCALSTACK === 'true'
    s3Client = new S3Client({
      region: config?.region || process.env.AWS_REGION || 'us-west-2',
      endpoint: config?.endpoint || (isLocalStack ? 'http://localhost:4566' : undefined),
      forcePathStyle: config?.forcePathStyle || isLocalStack
    })
  }
  return s3Client
}

export function configureS3Client(config: S3Config): void {
  s3Client = null
  getS3Client(config)
}
```

### ElectroDB Service
```typescript
import {Service} from 'electrodb'
import {Users, Files, Devices} from '../../src/entities'

let service: Service | null = null

export function getService(): Service {
  if (!service) {
    service = new Service({Users, Files, Devices})
  }
  return service
}

export const table = process.env.TABLE_NAME || 'MediaDownloader'
export function resetService(): void { service = null }
```

## Testing Benefits

### Works with Mocks
```typescript
// Mock BEFORE importing handler
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  headObject: jest.fn<() => Promise<{ContentLength: number}>>()
    .mockResolvedValue({ContentLength: 1024}),
  resetS3Client: jest.fn()
}))

const {handler} = await import('../src/index')

describe('GetFile handler', () => {
  it('gets file info', async () => {
    const result = await handler(event, context)
    expect(result.statusCode).toBe(200)  // Works!
  })
})
```

## Common Mistakes

### Creating Client at Module Level
```typescript
// ❌ WRONG
const s3 = new S3Client({region: 'us-west-2'})

// ✅ CORRECT
let s3: S3Client | null = null
function getS3Client() {
  if (!s3) s3 = new S3Client({region: 'us-west-2'})
  return s3
}
```

### Forgetting Reset Function
```typescript
// ❌ INCOMPLETE
let client: SomeClient | null = null
function getClient() {
  if (!client) client = new SomeClient()
  return client
}

// ✅ COMPLETE
let client: SomeClient | null = null
function getClient() {
  if (!client) client = new SomeClient()
  return client
}
export function resetClient() { client = null }
```

## Why This Pattern?

1. **Testability** - Mocks applied before client creation
2. **Environment Safety** - Client only created when needed
3. **Configuration Flexibility** - Can apply config before initialization
4. **LocalStack Support** - Can point to LocalStack endpoint
5. **Minimal Overhead** - Getter function adds negligible cost

## Enforcement

```bash
# Check for eager initialization
grep -rn "= new.*Client({" lib/vendor/AWS/*.ts | grep -v "function\|if ("
```

## Related Patterns
- [Jest ESM Mocking Strategy](Jest-ESM-Mocking-Strategy.md) - Mocking before imports
- [LocalStack Testing](../Integration/LocalStack-Testing.md) - Testing with LocalStack
- [AWS SDK Encapsulation Policy](../AWS/SDK-Encapsulation-Policy.md) - Vendor wrapper pattern

---

*Defer client initialization until first use. This enables proper mocking in tests and supports flexible configuration.*
