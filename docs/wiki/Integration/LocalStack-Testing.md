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

## Aurora DSQL Integration Testing

### Setup Helper

```typescript
import {setupTestDatabase, cleanupTestDatabase} from '../helpers/drizzle-localstack'

beforeAll(async () => {
  await setupTestDatabase()
})

afterAll(async () => {
  await cleanupTestDatabase()
})
```

**Note**: Integration tests use Aurora DSQL with Drizzle ORM. For unit tests, mock the query functions.

### Testing with Query Functions

```typescript
import {createUser, createFile, createUserFile, getUserFiles} from '#entities/queries'

test('user files relationship', async () => {
  // Create test data
  const user = await createUser({appleDeviceIdentifier: 'apple-1'})
  const file = await createFile({status: 'Downloaded', url: 'https://...'})
  await createUserFile({userId: user.id, fileId: file.id})

  // Query relationship
  const userFiles = await getUserFiles(user.id)

  expect(userFiles).toHaveLength(1)
  expect(userFiles[0].fileId).toBe(file.id)
})
```

**See**: [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) for comprehensive entity mocking examples

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

## Integration Test Coverage Matrix

| Lambda | Trigger Type | Test File | Coverage |
|--------|-------------|-----------|----------|
| ApiGatewayAuthorizer | API Gateway | `apiGatewayAuthorizer.dedicated.integration.test.ts` | Full |
| CleanupExpiredRecords | CloudWatch Schedule | `cleanupExpiredRecords.workflow.integration.test.ts` | Full |
| DeviceEvent | API Gateway | `deviceRegistration.integration.test.ts` | Partial |
| ListFiles | API Gateway | `listFiles.workflow.integration.test.ts` | Full |
| LoginUser | API Gateway | `auth.flow.integration.test.ts` | Partial |
| PruneDevices | CloudWatch Schedule | `pruneDevices.workflow.integration.test.ts` | Full |
| RefreshToken | API Gateway | `refreshToken.workflow.integration.test.ts` | Full |
| RegisterDevice | API Gateway | `deviceRegistration.integration.test.ts` | Full |
| S3ObjectCreated | S3 Event | `s3ObjectCreated.workflow.integration.test.ts` | Full |
| SendPushNotification | SQS | `sendPushNotification.workflow.integration.test.ts` | Full |
| StartFileUpload | SQS (EventBridge) | `startFileUpload.workflow.integration.test.ts` | Partial |
| UserDelete | API Gateway | `userDelete.cascade.integration.test.ts` | Full |
| UserSubscribe | API Gateway | `userSubscribe.workflow.integration.test.ts` | Partial |
| WebhookFeedly | API Gateway | `webhookFeedly.workflow.integration.test.ts` | Full |
| CloudfrontMiddleware | CloudFront | N/A | None (edge function) |
| MigrateDSQL | Manual CLI | N/A | None (utility) |

**Trigger Coverage Summary:**
- API Gateway: 10/10 tested
- SQS: 2/2 tested
- S3 Events: 1/1 tested
- CloudWatch Schedule: 2/2 tested
- EventBridge: 1/1 tested (E2E chain)
- CloudFront: 0/1 tested (edge functions not supported)

## Worker Schema Isolation

Integration tests use PostgreSQL schema isolation for parallel test execution:

```
globalSetup.ts       → Creates schemas worker_1...worker_8 before tests
                     └→ Reads migrations/0001_initial_schema.sql
                     └→ Applies Aurora DSQL → PostgreSQL adaptations
                     └→ Creates tables in each schema

setup.ts             → Sets USE_LOCALSTACK=true
                     └→ Initializes database connection
                     └→ Sets search_path to worker schema

postgres-helpers.ts  → getWorkerSchema() uses VITEST_POOL_ID
                     └→ Manages per-worker connections
                     └→ Sets search_path before each query
```

### Isolation Mechanisms

| Mechanism | Implementation | Purpose |
|-----------|---------------|---------|
| CI Isolation | `GITHUB_RUN_ID` prefix | Prevents concurrent CI runs from conflicting |
| Worker Isolation | Schemas (worker_1...worker_8) | Each Vitest worker gets own schema |
| Test Isolation | `truncateAllTables()` in afterEach | Clears data between tests |
| Connection Management | `max: 1` per worker | Avoids search_path issues with pool |

### Aurora DSQL → PostgreSQL Adaptations

| Aurora DSQL Feature | PostgreSQL Adaptation | Applied In |
|---------------------|----------------------|------------|
| `CREATE INDEX ASYNC` | `CREATE INDEX` | globalSetup.ts:77 |
| UUID PRIMARY KEY | TEXT PRIMARY KEY | globalSetup.ts:81 |
| UUID NOT NULL | TEXT NOT NULL | globalSetup.ts:82 |

## Known Limitations

1. **CloudFront edge functions** cannot be tested via LocalStack
2. **API Gateway rate limiting** must be mocked (LocalStack limitation)
3. **UUID columns use TEXT** in tests vs UUID in Aurora DSQL
4. **APNS push notifications** require mocking (external service)
5. **OAuth providers** require mocking (external service)

## Failure Scenario Testing

Failure scenarios are tested in `test/integration/workflows/failures/`:

| Category | Test File | Scenarios Covered |
|----------|-----------|-------------------|
| Database Failures | `database.failure.integration.test.ts` | Entity not found, constraint violations, cascade deletions |
| External Services | `externalServices.failure.integration.test.ts` | SNS endpoint disabled, SQS failures, partial batch failures |

See [Failure Scenario Testing](../Testing/Failure-Scenario-Testing.md) for detailed documentation.

## Related Patterns

- [Vendor Wrappers](../Conventions/Vendor-Encapsulation-Policy.md) - AWS SDK encapsulation
- [Integration Testing](../Testing/Integration-Testing.md) - Test strategies
- [Vitest Mocking Strategy](../Testing/Vitest-Mocking-Strategy.md) - Mocking patterns

---

*Use LocalStack for local AWS testing. Vendor wrappers automatically detect LocalStack mode.*