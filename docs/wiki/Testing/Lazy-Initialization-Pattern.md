# Lazy Initialization Pattern

## Quick Reference
- **When to use**: Modules that create AWS SDK clients or external connections at module level
- **Enforcement**: Required - prevents test failures from premature initialization
- **Impact if violated**: HIGH - Tests fail with SDK errors despite mocking

## Overview

Defer initialization of AWS SDK clients, database connections, and external services until they're actually used. This allows tests to mock dependencies before initialization occurs.

## The Problem

AWS SDK clients and external connections initialized at module level execute immediately when the module loads, **before** mocks are set up.

## Examples

### ❌ Incorrect - Eager Initialization

```typescript
// lib/vendor/AWS/S3.ts

// ❌ WRONG - Client created at module level
import {S3Client} from '@aws-sdk/client-s3'

// This runs immediately when module loads!
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-2'
})

export async function headObject(bucket: string, key: string) {
  // Uses client created at module load
  const command = new HeadObjectCommand({Bucket: bucket, Key: key})
  return await s3Client.send(command)
}
```

**Problem**: Tests that mock S3Client fail because the real client is created before the mock is set up.

### ✅ Correct - Lazy Initialization

```typescript
// lib/vendor/AWS/S3.ts

import {S3Client, HeadObjectCommand} from '@aws-sdk/client-s3'

// ✅ Client is null initially
let s3Client: S3Client | null = null

// ✅ Initialize only when first used
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-west-2'
    })
  }
  return s3Client
}

export async function headObject(bucket: string, key: string) {
  // Client created on first call, not at module load
  const client = getS3Client()
  const command = new HeadObjectCommand({Bucket: bucket, Key: key})
  return await client.send(command)
}

// ✅ For testing: reset the client
export function resetS3Client(): void {
  s3Client = null
}
```

### ✅ Correct - Lazy Initialization with X-Ray

```typescript
// lib/vendor/AWS/DynamoDB.ts

import {DynamoDBClient} from '@aws-sdk/client-dynamodb'
import {DynamoDBDocumentClient, QueryCommand} from '@aws-sdk/lib-dynamodb'
import {captureAWSClient} from './XRay'

let dynamoClient: DynamoDBDocumentClient | null = null

function getDynamoClient(): DynamoDBDocumentClient {
  if (!dynamoClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-west-2'
    })
    
    // Wrap with X-Ray before storing
    dynamoClient = DynamoDBDocumentClient.from(
      captureAWSClient(client)
    )
  }
  return dynamoClient
}

export async function query(
  tableName: string,
  keyName: string,
  keyValue: string
) {
  const client = getDynamoClient()
  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: `${keyName} = :value`,
    ExpressionAttributeValues: {':value': keyValue}
  })
  
  const result = await client.send(command)
  return result.Items || []
}

export function resetDynamoClient(): void {
  dynamoClient = null
}
```

### ✅ Correct - Lazy ElectroDB Service

```typescript
// lib/vendor/ElectroDB/service.ts

import {Service} from 'electrodb'
import {Users} from '../../src/entities/Users'
import {Files} from '../../src/entities/Files'
import {Devices} from '../../src/entities/Devices'

let service: Service | null = null

export function getService(): Service {
  if (!service) {
    service = new Service({
      Users,
      Files,
      Devices
    })
  }
  return service
}

export const table = process.env.TABLE_NAME || 'MediaDownloader'

export function resetService(): void {
  service = null
}
```

## Testing Benefits

### With Lazy Initialization

```typescript
// test/lambdas/GetFile/index.test.ts

// ✅ Mock BEFORE importing handler
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  headObject: jest.fn<() => Promise<{ContentLength: number}>>()
    .mockResolvedValue({ContentLength: 1024}),
  resetS3Client: jest.fn()  // Include reset function
}))

// Now import - S3Client won't be created yet
const {handler} = await import('../src/index')

describe('GetFile handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset between tests if needed
  })
  
  it('gets file info', async () => {
    const result = await handler(event, context)
    // Works! S3Client created on first use, which is after mock setup
    expect(result.statusCode).toBe(200)
  })
})
```

### Without Lazy Initialization (Fails)

```typescript
// ❌ This fails with lazy initialization missing

// Mock setup
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  headObject: jest.fn()
}))

// Import - S3Client already created at module level!
// Real AWS SDK client initialized before mock setup
const {handler} = await import('../src/index')

// Test fails: Cannot read property 'send' of undefined
```

## Pattern Variations

### Singleton with Configuration

```typescript
// lib/vendor/AWS/Lambda.ts

import {LambdaClient, InvokeCommand} from '@aws-sdk/client-lambda'

let lambdaClient: LambdaClient | null = null

interface LambdaConfig {
  region?: string
  endpoint?: string  // For LocalStack testing
}

function getLambdaClient(config?: LambdaConfig): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({
      region: config?.region || process.env.AWS_REGION || 'us-west-2',
      endpoint: config?.endpoint
    })
  }
  return lambdaClient
}

export async function invokeLambda(
  functionName: string,
  payload: any
): Promise<any> {
  const client = getLambdaClient()
  const command = new InvokeCommand({
    FunctionName: functionName,
    Payload: JSON.stringify(payload)
  })
  
  const result = await client.send(command)
  return JSON.parse(new TextDecoder().decode(result.Payload))
}

// For LocalStack testing
export function configureLambdaClient(config: LambdaConfig): void {
  lambdaClient = null  // Reset to apply new config
  getLambdaClient(config)  // Initialize with config
}

export function resetLambdaClient(): void {
  lambdaClient = null
}
```

### Factory Pattern

```typescript
// lib/vendor/AWS/SNS.ts

import {SNSClient, PublishCommand} from '@aws-sdk/client-sns'

// Factory function instead of singleton
function createSNSClient(): SNSClient {
  return new SNSClient({
    region: process.env.AWS_REGION || 'us-west-2'
  })
}

export async function publish(topicArn: string, message: any): Promise<void> {
  // Create client per call (or cache if performance matters)
  const client = createSNSClient()
  
  const command = new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify(message)
  })
  
  await client.send(command)
}

// No reset needed - new client each time
```

### Lazy with Memoization

```typescript
// lib/vendor/External/GitHub.ts

import {Octokit} from '@octokit/rest'

let octokit: Octokit | null = null

function getOctokit(): Octokit {
  if (!octokit) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable required')
    }
    
    octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    })
  }
  return octokit
}

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string
): Promise<number> {
  const client = getOctokit()
  
  const response = await client.issues.create({
    owner,
    repo,
    title,
    body
  })
  
  return response.data.number
}

export function resetGitHubClient(): void {
  octokit = null
}
```

## Rationale

### Why Defer Initialization

1. **Testability** - Mocks applied before client creation
2. **Environment Safety** - Client only created when actually needed
3. **Configuration Flexibility** - Can apply config before initialization
4. **LocalStack Support** - Can point to LocalStack endpoint
5. **Error Handling** - Initialization errors happen in controlled context

### Cost Considerations

1. **Minimal** - Getter function adds negligible overhead
2. **One-Time** - Client created once, reused for all calls
3. **Standard Pattern** - Singleton pattern is well-known
4. **Better Alternative** - Small cost vs broken tests

## Enforcement

### Code Review Checklist

- [ ] AWS SDK clients not created at module level
- [ ] Database connections deferred until first use
- [ ] External API clients lazily initialized
- [ ] Reset functions provided for testing
- [ ] Configuration applied before initialization

### Verification

```bash
# Check for eager initialization patterns
grep -rn "= new.*Client({" lib/vendor/AWS/*.ts | grep -v "function\|if ("

# Should only find initialization inside getter functions
```

## Common Mistakes

### Creating Client at Module Level

```typescript
// ❌ WRONG
const s3 = new S3Client({region: 'us-west-2'})  // Immediate creation

// ✅ CORRECT
let s3: S3Client | null = null
function getS3Client() {
  if (!s3) s3 = new S3Client({region: 'us-west-2'})
  return s3
}
```

### Forgetting Reset Function

```typescript
// ❌ INCOMPLETE - No way to reset for tests
let client: SomeClient | null = null
function getClient() {
  if (!client) client = new SomeClient()
  return client
}

// ✅ COMPLETE - Includes reset
let client: SomeClient | null = null
function getClient() {
  if (!client) client = new SomeClient()
  return client
}
export function resetClient() {
  client = null
}
```

### Initialization in Multiple Places

```typescript
// ❌ WRONG - Inconsistent initialization
export function operation1() {
  const client = new S3Client({region: 'us-west-2'})
  // ...
}

export function operation2() {
  const client = new S3Client({region: 'us-west-2'})
  // ...
}

// ✅ CORRECT - Single initialization point
let s3Client: S3Client | null = null
function getS3Client() {
  if (!s3Client) s3Client = new S3Client({region: 'us-west-2'})
  return s3Client
}

export function operation1() {
  const client = getS3Client()
  // ...
}

export function operation2() {
  const client = getS3Client()
  // ...
}
```

## Integration with LocalStack

```typescript
// lib/vendor/AWS/S3.ts

import {S3Client} from '@aws-sdk/client-s3'

let s3Client: S3Client | null = null

interface S3Config {
  region?: string
  endpoint?: string
  forcePathStyle?: boolean
}

function getS3Client(config?: S3Config): S3Client {
  if (!s3Client) {
    // LocalStack configuration support
    const isLocalStack = process.env.USE_LOCALSTACK === 'true'
    
    s3Client = new S3Client({
      region: config?.region || process.env.AWS_REGION || 'us-west-2',
      endpoint: config?.endpoint || (isLocalStack ? 'http://localhost:4566' : undefined),
      forcePathStyle: config?.forcePathStyle || isLocalStack  // Required for LocalStack
    })
  }
  return s3Client
}

export function configureS3Client(config: S3Config): void {
  s3Client = null  // Reset
  getS3Client(config)  // Initialize with config
}

export function resetS3Client(): void {
  s3Client = null
}
```

## Related Patterns

- [Jest ESM Mocking Strategy](Jest-ESM-Mocking-Strategy.md) - Mocking before imports
- [LocalStack Testing](../Integration/LocalStack-Testing.md) - Testing with LocalStack
- [AWS SDK Encapsulation Policy](../AWS/SDK-Encapsulation-Policy.md) - Vendor wrapper pattern

---

*Defer client initialization until first use. This enables proper mocking in tests and supports flexible configuration for different environments.*
