# Integration Testing

## Quick Reference
- **When to use**: Testing AWS service interactions and cross-component integration
- **Enforcement**: Required for AWS infrastructure changes
- **Impact if violated**: HIGH - Production issues not caught before deployment

## Overview

Integration tests verify that components work together correctly, especially AWS services. Use LocalStack for local AWS testing to catch integration issues before deploying to real AWS infrastructure.

## LocalStack Integration

LocalStack provides local AWS service emulation for integration testing without AWS costs.

### What is LocalStack?

LocalStack emulates AWS services locally:
- S3, DynamoDB, Lambda, SNS, SQS
- API Gateway, CloudWatch, X-Ray
- Free community edition for core services

### Setup

```yaml
# docker-compose.localstack.yml
version: '3.8'

services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"  # LocalStack gateway
    environment:
      - SERVICES=s3,dynamodb,lambda,sns,sqs,apigateway
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - LAMBDA_EXECUTOR=docker
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
      - "./localstack:/tmp/localstack"
```

### Starting LocalStack

```bash
# Start services
npm run localstack:start
# docker-compose -f docker-compose.localstack.yml up -d

# Stop services
npm run localstack:stop
# docker-compose -f docker-compose.localstack.yml down

# View logs
docker-compose -f docker-compose.localstack.yml logs -f localstack
```

## Test Structure

### Integration Test Organization

```
test/
├── integration/
│   ├── setup.ts           # LocalStack setup
│   ├── teardown.ts        # Cleanup
│   ├── s3.test.ts         # S3 integration tests
│   ├── dynamodb.test.ts   # DynamoDB integration tests
│   └── lambda.test.ts     # Lambda integration tests
└── helpers/
    └── localstack.ts      # LocalStack utilities
```

### Setup and Teardown

```typescript
// test/integration/setup.ts

import {S3Client, CreateBucketCommand} from '@aws-sdk/client-s3'
import {DynamoDBClient, CreateTableCommand} from '@aws-sdk/client-dynamodb'

const localstackEndpoint = 'http://localhost:4566'

export async function setupLocalStack() {
  // Create S3 bucket
  const s3 = new S3Client({
    endpoint: localstackEndpoint,
    region: 'us-west-2',
    forcePathStyle: true
  })
  
  await s3.send(new CreateBucketCommand({
    Bucket: 'test-bucket'
  }))
  
  // Create DynamoDB table
  const dynamodb = new DynamoDBClient({
    endpoint: localstackEndpoint,
    region: 'us-west-2'
  })
  
  await dynamodb.send(new CreateTableCommand({
    TableName: 'TestTable',
    KeySchema: [
      {AttributeName: 'pk', KeyType: 'HASH'},
      {AttributeName: 'sk', KeyType: 'RANGE'}
    ],
    AttributeDefinitions: [
      {AttributeName: 'pk', AttributeType: 'S'},
      {AttributeName: 'sk', AttributeType: 'S'}
    ],
    BillingMode: 'PAY_PER_REQUEST'
  }))
}

export async function teardownLocalStack() {
  // Cleanup not strictly necessary for LocalStack
  // Resources cleared on container restart
}
```

## Integration Test Examples

### ✅ Correct - S3 Integration Test

```typescript
// test/integration/s3.test.ts

import {createS3Upload, headObject} from '../../lib/vendor/AWS/S3'
import {setupLocalStack, teardownLocalStack} from './setup'

// Configure vendor wrapper for LocalStack
process.env.USE_LOCALSTACK = 'true'

describe('S3 Integration', () => {
  beforeAll(async () => {
    await setupLocalStack()
  })
  
  afterAll(async () => {
    await teardownLocalStack()
  })
  
  it('uploads and retrieves file from S3', async () => {
    const bucket = 'test-bucket'
    const key = 'test-file.txt'
    const content = 'Test content'
    
    // Upload file
    const upload = createS3Upload(bucket, key, content, 'text/plain')
    await upload.done()
    
    // Verify upload
    const metadata = await headObject(bucket, key)
    expect(metadata.ContentLength).toBeGreaterThan(0)
  })
  
  it('handles missing files correctly', async () => {
    await expect(
      headObject('test-bucket', 'nonexistent.txt')
    ).rejects.toThrow()
  })
})
```

### ✅ Correct - DynamoDB Integration Test

```typescript
// test/integration/dynamodb.test.ts

import {Users} from '../../src/entities/Users'
import {setupLocalStack} from './setup'

process.env.USE_LOCALSTACK = 'true'
process.env.TABLE_NAME = 'TestTable'

describe('DynamoDB Integration', () => {
  beforeAll(async () => {
    await setupLocalStack()
  })
  
  it('creates and retrieves user', async () => {
    const user = {
      userId: 'test-user',
      email: 'test@example.com',
      createdAt: Date.now()
    }
    
    // Create user
    await Users.create(user).go()
    
    // Retrieve user
    const result = await Users.get({userId: user.userId}).go()
    
    expect(result.data).toMatchObject({
      userId: user.userId,
      email: user.email
    })
  })
  
  it('updates user email', async () => {
    const userId = 'update-test-user'
    
    // Create user
    await Users.create({
      userId,
      email: 'old@example.com',
      createdAt: Date.now()
    }).go()
    
    // Update email
    await Users.update({userId})
      .set({email: 'new@example.com'})
      .go()
    
    // Verify update
    const result = await Users.get({userId}).go()
    expect(result.data?.email).toBe('new@example.com')
  })
})
```

### ✅ Correct - Lambda Integration Test

```typescript
// test/integration/lambda.test.ts

import {handler} from '../../src/lambdas/ProcessFile/src/index'
import {setupLocalStack} from './setup'

process.env.USE_LOCALSTACK = 'true'

describe('ProcessFile Lambda Integration', () => {
  beforeAll(async () => {
    await setupLocalStack()
  })
  
  it('processes file end-to-end', async () => {
    const event = {
      fileId: 'test-file-123',
      url: 'https://example.com/video.mp4'
    }
    
    const result = await handler(event, {} as any)
    
    expect(result).toMatchObject({
      statusCode: 200,
      fileId: event.fileId
    })
    
    // Verify side effects (file in S3, record in DynamoDB)
    const metadata = await headObject('test-bucket', `files/${event.fileId}`)
    expect(metadata).toBeDefined()
    
    const file = await Files.get({fileId: event.fileId}).go()
    expect(file.data?.status).toBe('complete')
  })
})
```

## Testing Patterns

### Environment Configuration

```typescript
// test/helpers/localstack.ts

export function configureLocalStack() {
  process.env.USE_LOCALSTACK = 'true'
  process.env.AWS_REGION = 'us-west-2'
  process.env.AWS_ACCESS_KEY_ID = 'test'
  process.env.AWS_SECRET_ACCESS_KEY = 'test'
  process.env.TABLE_NAME = 'TestTable'
  process.env.BUCKET_NAME = 'test-bucket'
}

export function isLocalStackRunning(): Promise<boolean> {
  return fetch('http://localhost:4566/_localstack/health')
    .then(() => true)
    .catch(() => false)
}
```

### Retry Logic for Eventual Consistency

```typescript
async function waitForResource<T>(
  fn: () => Promise<T>,
  maxAttempts = 10,
  delayMs = 500
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('Max attempts reached')
}

// Usage
it('waits for DynamoDB consistency', async () => {
  await Users.create(user).go()
  
  // Wait for eventual consistency
  const result = await waitForResource(() =>
    Users.get({userId: user.userId}).go()
  )
  
  expect(result.data).toBeDefined()
})
```

### Data Cleanup Between Tests

```typescript
describe('File operations', () => {
  beforeEach(async () => {
    // Clean data before each test
    await clearTestData()
  })
  
  afterEach(async () => {
    // Optional: cleanup after test
    await clearTestData()
  })
})

async function clearTestData() {
  // Delete all items from table
  const items = await Users.scan.go()
  
  for (const item of items.data) {
    await Users.delete({userId: item.userId}).go()
  }
}
```

## Running Integration Tests

### NPM Scripts

```json
{
  "scripts": {
    "localstack:start": "docker-compose -f docker-compose.localstack.yml up -d",
    "localstack:stop": "docker-compose -f docker-compose.localstack.yml down",
    "test:integration": "USE_LOCALSTACK=true jest --testPathPattern=test/integration",
    "test:integration:full": "npm run localstack:start && npm run test:integration && npm run localstack:stop"
  }
}
```

### Running Tests

```bash
# Start LocalStack first
npm run localstack:start

# Run integration tests
npm run test:integration

# Or run full suite with lifecycle
npm run test:integration:full

# Run specific test file
npm run test:integration -- s3.test.ts
```

## Unit Tests vs Integration Tests

### Unit Tests

- Mock ALL dependencies
- Test single component in isolation
- Fast execution (milliseconds)
- No external services required
- Run in CI on every commit

### Integration Tests

- Use real (LocalStack) services
- Test multiple components together
- Slower execution (seconds)
- Require LocalStack running
- Run before deployment

## CI/CD Integration

```yaml
# .github/workflows/test.yml

name: Test

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
  
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      
      - name: Start LocalStack
        run: |
          docker-compose -f docker-compose.localstack.yml up -d
          sleep 10  # Wait for services to be ready
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Stop LocalStack
        if: always()
        run: docker-compose -f docker-compose.localstack.yml down
```

## Best Practices

### Do's

✅ Use LocalStack for local AWS testing
✅ Test happy paths and error conditions
✅ Clean up test data between tests
✅ Use realistic test data
✅ Test eventual consistency scenarios
✅ Verify side effects (S3 files, DynamoDB records)
✅ Configure vendor wrappers for LocalStack

### Don'ts

❌ Don't test against real AWS in CI
❌ Don't leave test data in LocalStack
❌ Don't assume instant consistency
❌ Don't skip integration tests
❌ Don't mock in integration tests (use real LocalStack)
❌ Don't hard-code LocalStack URLs (use env vars)

## Rationale

### Why Integration Tests?

1. **Catch Integration Issues** - Unit tests can't catch service interaction bugs
2. **Verify Configuration** - Ensure AWS resources configured correctly
3. **Test Edge Cases** - Eventual consistency, rate limits, timeouts
4. **Confidence** - Know code works with real services
5. **Cost-Effective** - LocalStack is free vs real AWS

### Why LocalStack?

1. **No AWS Costs** - Test locally without charges
2. **Fast Feedback** - No network latency to AWS
3. **Consistent Environment** - Same setup for all developers
4. **Offline Development** - Work without internet
5. **Safe Experimentation** - Can't break production

## Troubleshooting

### LocalStack Not Starting

```bash
# Check if port is in use
lsof -i :4566

# View LocalStack logs
docker-compose -f docker-compose.localstack.yml logs -f

# Restart LocalStack
docker-compose -f docker-compose.localstack.yml restart
```

### Tests Timing Out

```typescript
// Increase Jest timeout for integration tests
jest.setTimeout(30000)  // 30 seconds

// Or per test
it('long running test', async () => {
  // Test code
}, 60000)  // 60 seconds
```

### Connection Refused Errors

```bash
# Verify LocalStack is running
curl http://localhost:4566/_localstack/health

# Check Docker status
docker ps | grep localstack
```

## Related Patterns

- [Lazy Initialization Pattern](Lazy-Initialization-Pattern.md) - Configure clients for LocalStack
- [Jest ESM Mocking Strategy](Jest-ESM-Mocking-Strategy.md) - Unit test mocking
- [AWS SDK Encapsulation Policy](../AWS/SDK-Encapsulation-Policy.md) - Vendor wrapper pattern

---

*Use LocalStack for integration testing to catch service interaction issues before deploying to AWS. Maintain clear separation between fast unit tests and slower integration tests.*
