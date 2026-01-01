# LocalStack Testing

## Quick Reference
- **When to use**: Local AWS service testing
- **Enforcement**: Recommended for integration tests
- **Impact if violated**: LOW - Tests run against real AWS

## Setup

```bash
# Start LocalStack
npm run localstack:start

# Run integration tests
npm run test:integration

# Full test suite with lifecycle
npm run test:integration:full
```

## Configuration

### Docker Compose

```yaml
# docker-compose.yml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,dynamodb,lambda,sns,sqs,apigateway
      - AWS_DEFAULT_REGION=us-west-2
```

### Test Environment

```typescript
// test/helpers/localstack-config.ts
export const localstackConfig = {
  endpoint: 'http://localhost:4566',
  region: 'us-west-2',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
}
```

## Vendor Wrapper Pattern

All AWS SDK clients use vendor wrappers that automatically detect LocalStack:

```typescript
// lib/vendor/AWS/DynamoDB.ts
function getDynamoDbClient(): DynamoDBClient {
  if (process.env.USE_LOCALSTACK === 'true') {
    return new DynamoDBClient({
      endpoint: 'http://localhost:4566',
      region: 'us-west-2'
    })
  }
  return new DynamoDBClient()
}
```

## Integration Test Pattern

```typescript
// test/integration/lambda.test.ts
import {beforeAll, afterAll, test} from '@jest/globals'
import {setupLocalStack, teardownLocalStack} from '../helpers/localstack'

beforeAll(async () => {
  await setupLocalStack()
})

afterAll(async () => {
  await teardownLocalStack()
})

test('Lambda processes file', async () => {
  // Test against LocalStack services
  const result = await lambda.invoke({
    FunctionName: 'ProcessFile',
    Payload: JSON.stringify({fileId: 'test'})
  })

  expect(result.StatusCode).toBe(200)
})
```

## Service-Specific Setup

### DynamoDB
```bash
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name MediaDownloader \
  --attribute-definitions AttributeName=PK,AttributeType=S
```

### S3
```bash
aws --endpoint-url=http://localhost:4566 s3 mb s3://media-files
```

### Lambda
```bash
aws --endpoint-url=http://localhost:4566 lambda create-function \
  --function-name ProcessFile \
  --runtime nodejs22.x
```

## ElectroDB Integration Testing

### Setup Helper

```typescript
import {setupLocalStackTable, cleanupLocalStackTable} from '../helpers/electrodb-localstack'

beforeAll(async () => {
  await setupLocalStackTable()
})

afterAll(async () => {
  await cleanupLocalStackTable()
})
```

**Creates**: MediaDownloader table with all GSIs (gsi1/userResources, gsi2/fileUsers, gsi3/deviceUsers)

### Testing Collections

```typescript
import {collections} from '../../../src/entities/Collections'

test('userResources collection', async () => {
  // Create test data
  await Users.create({userId: 'user-1', appleDeviceIdentifier: 'apple-1'}).go()
  await Files.create({fileId: 'file-1', status: 'Downloaded', url: 'https://...'}).go()
  await UserFiles.create({userId: 'user-1', fileId: 'file-1'}).go()

  // Query collection (JOIN-like operation)
  const result = await collections.userResources({userId: 'user-1'}).go()

  // Validate single-table design
  expect(result.data.Users).toHaveLength(1)
  expect(result.data.Files).toHaveLength(1)
  expect(result.data.UserFiles).toHaveLength(1)
})
```

**See**: [ElectroDB Testing Patterns](../Testing/ElectroDB-Testing-Patterns.md) for comprehensive examples

## Common Issues

| Issue | Solution |
|-------|----------|
| Connection refused | Ensure LocalStack is running |
| Service not available | Check SERVICES env var |
| Credentials error | Use 'test' for both key and secret |
| Region mismatch | Use us-west-2 consistently |

## True Integration vs Mock Disguised

### The Problem

"Mock disguised" tests look like integration tests but mock AWS vendor wrappers instead of using LocalStack. This defeats the purpose of integration testing.

```typescript
// ❌ WRONG: Mock Disguised Test
const {publishSnsEventMock} = vi.hoisted(() => ({publishSnsEventMock: vi.fn()}))
vi.mock('#lib/vendor/AWS/SNS', () => ({publishSnsEvent: publishSnsEventMock}))

test('sends notification', async () => {
  await handler(event, context)
  expect(publishSnsEventMock).toHaveBeenCalled() // Testing mock, not real SNS
})
```

```typescript
// ✅ CORRECT: True Integration Test
import {createTestPlatformApplication, createTestEndpoint} from '../helpers/sns-helpers'

let platformAppArn: string
let endpointArn: string

beforeAll(async () => {
  platformAppArn = await createTestPlatformApplication('test-app')
  endpointArn = await createTestEndpoint(platformAppArn, 'device-token')
})

test('sends notification', async () => {
  await handler(event, context)
  // Real SNS endpoint receives real message
})
```

### When Mocking IS Acceptable

Only mock external services that cannot be emulated by LocalStack:

| Service | Mock? | Reason |
|---------|-------|--------|
| SNS, SQS, S3, EventBridge | ❌ No | LocalStack provides full emulation |
| PostgreSQL | ❌ No | Real database via Docker |
| APNS (Apple Push) | ✅ Yes | External service, no emulator |
| OAuth Providers | ✅ Yes | Requires real identity provider |
| GitHub API | ✅ Yes | External service |
| API Gateway Rate Limiting | ✅ Yes | LocalStack limitation |

### SNS Test Helpers

Use the SNS vendor wrapper for test operations:

```typescript
import {
  createTestPlatformApplication,
  createTestEndpoint,
  createTestTopic,
  deleteTestPlatformApplication,
  deleteTestEndpoint,
  deleteTestTopic,
  generateIsolatedAppName
} from '../helpers/sns-helpers'

describe('SNS Integration Test', () => {
  let platformAppArn: string
  let endpointArn: string
  const appName = generateIsolatedAppName('test-push')

  beforeAll(async () => {
    platformAppArn = await createTestPlatformApplication(appName)
    endpointArn = await createTestEndpoint(platformAppArn, `token-${Date.now()}`)
  })

  afterAll(async () => {
    await deleteTestEndpoint(endpointArn)
    await deleteTestPlatformApplication(platformAppArn)
  })

  test('publishes to endpoint', async () => {
    // Test with real LocalStack SNS
  })
})
```

### CI Isolation

Use `generateIsolatedAppName()` for CI-safe platform application names:

```typescript
// Generates: "test-push-run12345-a1b2c3d4" in CI
// Generates: "test-push-1704067200000-a1b2c3d4" locally
const appName = generateIsolatedAppName('test-push')
```

## Best Practices

1. **Use vendor wrappers** - Automatic LocalStack detection
2. **Set UseLocalstack=true** - Enable LocalStack mode
3. **Clean state between tests** - Reset services in afterEach
4. **Mock external services only** - APNS, OAuth, GitHub API
5. **Never mock AWS vendors** - Use real LocalStack services
6. **Use isolated names in CI** - `generateIsolatedAppName()` for SNS apps

## Related Patterns

- [Vendor Wrappers](../Conventions/Vendor-Encapsulation-Policy.md) - AWS SDK encapsulation
- [Integration Testing](../Testing/Integration-Testing.md) - Test strategies
- [Jest ESM Mocking](../Testing/Vitest-Mocking-Strategy.md) - Mocking patterns

---

*Use LocalStack for local AWS testing. Vendor wrappers automatically detect LocalStack mode.*