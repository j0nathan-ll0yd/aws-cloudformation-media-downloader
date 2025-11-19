# Integration Test Style Guide

> **Extends [Test Style Guide](./testStyleGuide.md)** - read that first for base patterns.

Integration tests verify system behavior against real AWS infrastructure (LocalStack). They test orchestration logic, not AWS SDK behavior.

---

## Core Principles

1. **Test YOUR orchestration logic, not AWS SDK behavior**
2. **Keep tests self-documenting** - minimize comments
3. **Isolate tests completely** - recreate tables in beforeEach
4. **DRY with helpers** - extract repeated structures
5. **Mock external invocations** - don't call other Lambdas

---

## File Organization

```
test/integration/workflows/
├── lambdaName.workflow.integration.test.ts
└── helpers/
    ├── dynamodb-helpers.ts
    ├── s3-helpers.ts
    └── lambda-context.ts
```

**Naming:** `{lambdaName}.workflow.integration.test.ts` for workflow tests.

---

## Module Mocking (Jest ESM Workaround)

Jest's `unstable_mockModule` has path resolution issues with relative imports from `test/integration/setup.ts` context.

### ❌ DON'T: Relative paths fail
```typescript
jest.unstable_mockModule('../../../src/lib/vendor/AWS/Lambda', () => ({
  invokeLambda: mockFn
}))
// Error: Cannot find module
```

### ❌ DON'T: Hardcoded absolute paths
```typescript
jest.unstable_mockModule('/Users/you/project/src/lib/vendor/AWS/Lambda', () => ({
  invokeLambda: mockFn
}))
// Breaks on other machines
```

### ✅ DO: Compute path from test file location
```typescript
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const lambdaModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/Lambda')

const invokeLambdaMock = jest.fn<() => Promise<{StatusCode: number}>>()
jest.unstable_mockModule(lambdaModulePath, () => ({
  invokeLambda: invokeLambdaMock,
  invokeAsync: invokeLambdaMock
}))
```

**Why:** Resolves path at runtime relative to test file, works on any machine.

---

## Test Data & Fixtures

### Helper Functions for Repeated Structures

Extract repeated data structures into helpers in the test file.

✅ **DO: Create helpers for repeated patterns**
```typescript
function createScheduledEvent(eventId: string): ScheduledEvent {
  return {
    id: eventId,
    version: '0',
    account: '123456789012',
    'detail-type': 'Scheduled Event' as const,
    source: 'aws.events',
    time: new Date().toISOString(),
    region: 'us-west-2',
    resources: ['arn:aws:events:us-west-2:123456789012:rule/Rule'],
    detail: {}
  }
}

async function insertPendingFile(fileId: string, availableAt: number, title?: string) {
  await insertFile({
    fileId,
    status: FileStatus.PendingMetadata,
    availableAt,
    title: title || `Test Video ${fileId}`
  })
}

// Usage
await insertPendingFile('video-1', Date.now() - 1000)
const event = createScheduledEvent('test-event-1')
```

### JSON Fixtures for Complex Objects

For large objects used across multiple tests, use JSON fixtures.

✅ **DO: Use fixtures for API Gateway events**
```typescript
// Import fixture
const {default: apiGatewayEventFixture} = await import(
  '../../../src/lambdas/WebhookFeedly/test/fixtures/APIGatewayEvent.json',
  {assert: {type: 'json'}}
)

// Helper to customize fixture
function createWebhookEvent(url: string, userId: string): CustomAPIGatewayRequestAuthorizerEvent {
  const event = JSON.parse(JSON.stringify(apiGatewayEventFixture))
  event.body = JSON.stringify({articleURL: url, backgroundMode: false})
  event.requestContext.authorizer.principalId = userId
  return event
}
```

**When to use helpers vs fixtures:**
- **Helper function:** 2-10 line objects, test-specific variations
- **JSON fixture:** 50+ line objects, reused across unit + integration tests

---

## Comment Discipline

Integration tests should be **self-documenting**. Only comment non-obvious behavior.

### ❌ DON'T: State the obvious
```typescript
// Arrange: Insert 3 pending files ready to download
await Promise.all(fileIds.map((fileId) => insertPendingFile(fileId, now - 1000)))

// Act: Invoke FileCoordinator handler
const result = await handler(event, mockContext)

// Assert: Lambda response is successful
expect(result.statusCode).toBe(200)
```

### ✅ DO: Only comment non-obvious orchestration details
```typescript
await Promise.all(fileIds.map((fileId) => insertPendingFile(fileId, now - 1000)))

const result = await handler(event, mockContext)

expect(result.statusCode).toBe(200)
expect(invokeLambdaMock).toHaveBeenCalledTimes(10)

// Both invocations scan all files (idempotent)
// StartFileUpload handles deduplication via conditional updates
```

**Comment when:**
- Explaining idempotency behavior
- Clarifying why a test allows duplicate invocations
- Documenting timing dependencies
- Explaining LocalStack limitations

**Don't comment:**
- Arrange/Act/Assert labels
- What the test is testing (test name says it)
- Obvious assertions

---

## Table Lifecycle Management

### Complete Isolation Between Tests

Each test must start with a clean database state.

✅ **DO: Recreate tables in beforeEach**
```typescript
describe('Lambda Workflow Tests', () => {
  beforeAll(async () => {
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    await deleteFilesTable()
  })

  beforeEach(async () => {
    // Recreate table for complete isolation
    await deleteFilesTable()
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 500))
  })

  test('test case', async () => {
    // Insert test-specific data
    await insertFile({...})
  })
})
```

**Why:** Prevents test pollution. Tests can run in any order.

### LocalStack Timing

Tables need time to become ready after creation.

```typescript
await createFilesTable()
await new Promise((resolve) => setTimeout(resolve, 500))  // Wait for table
```

**Typical timings:**
- `beforeAll`: 1000ms (initial setup, less critical)
- `beforeEach`: 500ms (balance between speed and reliability)

---

## Mock Management

### Clear Mocks Properly

Both `jest.clearAllMocks()` and `mock.mockClear()` are needed.

✅ **DO: Clear at both levels**
```typescript
beforeEach(async () => {
  // Clear Jest's global mock state
  jest.clearAllMocks()

  // Clear individual mock call history
  invokeLambdaMock.mockClear()
  sendMessageMock.mockClear()

  // Reset mock implementations
  invokeLambdaMock.mockResolvedValue({StatusCode: 202})
  sendMessageMock.mockResolvedValue({MessageId: 'test-id'})

  // Recreate tables...
})
```

**Why `jest.clearAllMocks()` isn't enough:** Module-level mocks created with `unstable_mockModule` need explicit clearing.

---

## Type Assertions for Mock Calls

Mock call arguments lose type information. Use double casting.

### Type Definitions

```typescript
type LambdaCallArgs = [string, Record<string, unknown>]
type SQSCallArgs = [{QueueUrl: string; MessageBody: string; MessageAttributes?: ...}]
```

### Accessing Mock Arguments

✅ **DO: Double cast through unknown**
```typescript
const invocationPayload = (invokeLambdaMock.mock.calls as unknown as LambdaCallArgs[])[0][1] as unknown as FileInvocationPayload

const messageParams = (sendMessageMock.mock.calls as unknown as SQSCallArgs[])[0][0]
```

**Why double cast:**
1. First cast: `mock.calls` is `[][]`, doesn't match tuple shape
2. Through `unknown`: Allows the cast
3. Second cast: To your payload type

### Mapping Multiple Calls

```typescript
const invocationPayloads = (invokeLambdaMock.mock.calls as unknown as LambdaCallArgs[]).map(
  (call) => call[1] as unknown as FileInvocationPayload
)
const invokedFileIds = invocationPayloads.map((payload) => payload.fileId).sort()
```

---

## Test Structure Template

```typescript
import {describe, test, expect, beforeAll, afterAll, beforeEach, jest} from '@jest/globals'
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

// Environment setup
const TEST_TABLE = 'test-files'
process.env.DynamoDBTableFiles = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

// Type definitions
interface PayloadType {
  fileId: string
}
type MockCallArgs = [string, Record<string, unknown>]

// Compute module paths
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const vendorModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/Service')

// Module-level mocks
const mockFn = jest.fn<() => Promise<{StatusCode: number}>>()
jest.unstable_mockModule(vendorModulePath, () => ({
  functionName: mockFn
}))

const {handler} = await import('../../../src/lambdas/LambdaName/src/index')

// Helper functions
function createTestEvent(id: string): EventType {
  return {/* ... */}
}

async function insertTestData(id: string) {
  await insertFile({/* ... */})
}

describe('Lambda Workflow Integration Tests', () => {
  let mockContext: any

  beforeAll(async () => {
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    mockContext = createMockContext()
  })

  afterAll(async () => {
    await deleteFilesTable()
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    mockFn.mockClear()
    mockFn.mockResolvedValue({StatusCode: 202})

    await deleteFilesTable()
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 500))
  })

  test('should do something specific', async () => {
    await insertTestData('test-id')

    const result = await handler(createTestEvent('event-1'), mockContext)

    expect(result.statusCode).toBe(200)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})
```

---

## Common Patterns

### Testing Fan-Out Operations

```typescript
test('should fan-out to multiple Lambda invocations', async () => {
  const fileIds = ['video-1', 'video-2', 'video-3']
  await Promise.all(fileIds.map((id) => insertPendingFile(id, Date.now() - 1000)))

  const result = await handler(createScheduledEvent('test'), mockContext)

  expect(result.statusCode).toBe(200)
  expect(invokeLambdaMock).toHaveBeenCalledTimes(3)

  const invocationPayloads = (invokeLambdaMock.mock.calls as unknown as LambdaCallArgs[]).map(
    (call) => call[1] as unknown as {fileId: string}
  )
  const invokedFileIds = invocationPayloads.map((p) => p.fileId).sort()

  expect(invokedFileIds).toEqual(fileIds.sort())
})
```

### Testing Empty Queue Handling

```typescript
test('should handle empty queue gracefully', async () => {
  const result = await handler(createScheduledEvent('test'), mockContext)

  expect(result.statusCode).toBe(200)
  expect(invokeLambdaMock).not.toHaveBeenCalled()
})
```

### Testing Time-Based Filters

```typescript
test('should only process files with availableAt <= now', async () => {
  const now = Date.now()

  await insertPendingFile('past-video', now - 10000)
  await insertPendingFile('future-video', now + 86400000)
  await insertPendingFile('now-video', now)

  const result = await handler(createScheduledEvent('test'), mockContext)

  expect(invokeLambdaMock).toHaveBeenCalledTimes(2)

  const invokedFileIds = /* extract and assert */
  expect(invokedFileIds).toEqual(['now-video', 'past-video'])
})
```

### Testing Idempotency

```typescript
test('should handle concurrent execution without conflicts', async () => {
  const fileIds = ['concurrent-1', 'concurrent-2', 'concurrent-3']
  await Promise.all(fileIds.map((id) => insertPendingFile(id, Date.now() - 1000)))

  const [result1, result2] = await Promise.all([
    handler(createScheduledEvent('event-1'), mockContext),
    handler(createScheduledEvent('event-2'), mockContext)
  ])

  expect(result1.statusCode).toBe(200)
  expect(result2.statusCode).toBe(200)

  // Both invocations scan all files (idempotent)
  // Downstream Lambda handles deduplication
  expect(invokeLambdaMock).toHaveBeenCalledTimes(6)  // 3 files × 2 invocations
})
```

---

## Checklist

Before committing integration test changes:

- [ ] Module mocks use computed paths (not hardcoded)
- [ ] Helper functions for repeated structures
- [ ] JSON fixtures for complex objects (50+ lines)
- [ ] Comments only for non-obvious behavior
- [ ] Tables recreated in beforeEach
- [ ] Both `jest.clearAllMocks()` and `mock.mockClear()` called
- [ ] Mock type assertions use double casting
- [ ] LocalStack timing delays included
- [ ] Tests run in isolation (any order)
- [ ] Test names are concise and descriptive

---

## Anti-Patterns

### ❌ DON'T: Hardcode absolute paths
```typescript
jest.unstable_mockModule('/Users/you/project/src/lib/vendor/AWS/Lambda', ...)
```

### ❌ DON'T: Repeat inline event objects
```typescript
test('test 1', async () => {
  const event = {id: 'x', version: '0', account: '123', ...}  // 10 lines
})

test('test 2', async () => {
  const event = {id: 'y', version: '0', account: '123', ...}  // Same 10 lines
})
```

### ❌ DON'T: Comment the obvious
```typescript
// Arrange
const fileIds = ['video-1', 'video-2']
// Act
const result = await handler(event, mockContext)
// Assert
expect(result.statusCode).toBe(200)
```

### ❌ DON'T: Share state between tests
```typescript
beforeAll(async () => {
  await createFilesTable()
  await insertFile({fileId: 'shared-data'})  // Shared across all tests ❌
})
```

### ❌ DON'T: Single-cast mock calls
```typescript
const payload = invokeLambdaMock.mock.calls[0][1] as FileInvocationPayload
// Error: Tuple type '[]' has no element at index '1'
```

---

## Related Guides

- [Test Style Guide](./testStyleGuide.md) - Base testing patterns
- [Lambda Style Guide](./lambdaStyleGuide.md) - Lambda implementation patterns

---

**Remember:** Integration tests verify YOUR orchestration logic against real infrastructure. Keep them clean, isolated, and self-documenting.
