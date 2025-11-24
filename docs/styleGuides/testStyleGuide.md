# Lambda Test Style Guide

This document defines the testing standards and patterns for Lambda function tests.

## Testing Philosophy

### Test YOUR Code, Not Library Code

**Core Principle:** Integration tests should validate YOUR orchestration logic, not AWS SDK behavior.

**Wrong Focus (Testing Libraries):**
- ❌ "Can I upload to S3?" → Testing AWS SDK
- ❌ "Does multipart upload work?" → Testing AWS SDK
- ❌ "Can I query DynamoDB?" → Testing AWS SDK

**Correct Focus (Testing YOUR Business Logic):**
- ✅ "Does the complete download workflow succeed?" → Testing YOUR code
- ✅ "When DynamoDB query returns files, does Lambda fan-out work?" → Testing YOUR orchestration
- ✅ "After S3 upload, is DynamoDB updated with correct status?" → Testing YOUR state management
- ✅ "Does error handling rollback DynamoDB when S3 fails?" → Testing YOUR error recovery

### Unit Tests vs Integration Tests

**Unit Tests:**
- Mock ALL external dependencies (AWS services, external APIs)
- Test individual function logic in isolation
- Fast execution (milliseconds)
- High coverage of edge cases and error paths
- Located in: `src/*/test/index.test.ts`

**Integration Tests:**
- Use real AWS services (via LocalStack)
- Test multi-service workflows end-to-end
- Test YOUR orchestration, state management, error handling
- Coverage of vendor wrappers is a SIDE EFFECT, not the goal
- Located in: `test/integration/workflows/*.workflow.integration.test.ts`

### Workflow-Based Integration Testing

Prioritize integration tests by workflow complexity:

**High Priority (Multi-Service Workflows):**
- Test complete end-to-end workflows (webhook → DynamoDB → queue → Lambda → S3)
- Test state transitions across services (pending → downloading → downloaded)
- Test error rollback logic (S3 failure → DynamoDB update to "failed")
- Test fan-out patterns (one Lambda invoking multiple others)

**Medium Priority (Single Service + Logic):**
- Test query filtering and pagination
- Test presigned URL generation
- Test conditional creates and updates

**Low Priority (Simple CRUD):**
- Don't write integration tests just for coverage
- If the function is pure CRUD with no orchestration, unit tests are sufficient

### Coverage Philosophy

**Coverage Should Be a Side Effect, Not a Goal:**

Unit test coverage targets YOUR application logic:
- Lambda handlers: Aim for 80%+ coverage
- Utility functions: Aim for 90%+ coverage
- Vendor wrappers: Ignore in unit tests (use `/* c8 ignore */`)

Integration test coverage happens naturally:
- Vendor wrappers get exercised by workflow tests
- Don't write integration tests to hit coverage targets
- Don't write shallow "library behavior" tests

**Success Metric:** Coverage of YOUR CODE, not library code.

### Integration Test Organization

Structure integration tests by workflow, not by service:

```
test/integration/
├── workflows/                                   # Workflow-based tests
│   ├── webhookFeedly.workflow.integration.test.ts
│   ├── fileCoordinator.workflow.integration.test.ts
│   ├── startFileUpload.workflow.integration.test.ts
│   └── listFiles.workflow.integration.test.ts
└── helpers/                                     # Test utilities
    ├── dynamodb-helpers.ts
    ├── s3-helpers.ts
    └── lambda-helpers.ts
```

**Avoid:**
- ❌ `test/integration/s3/s3.integration.test.ts` (testing AWS SDK)
- ❌ `test/integration/dynamodb/query.integration.test.ts` (testing AWS SDK)

**Prefer:**
- ✅ `test/integration/workflows/startFileUpload.workflow.integration.test.ts` (testing YOUR workflow)

## File Structure and Organization

### Import Order (STRICT)

```typescript
// 1. Jest imports FIRST
import {describe, expect, test, jest, beforeEach} from '@jest/globals'

// 2. Test utilities
import {testContext} from '../../../util/jest-setup'

// 3. External libraries (if needed)
import {v4 as uuidv4} from 'uuid'

// 4. Type imports
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'
import {FileStatus} from '../../../types/enums'

// 5. Constants
const fakeUserId = uuidv4()
```

### Mock Setup Pattern

Mocks MUST be created BEFORE importing the module under test:

```typescript
// 1. Create mock functions
const queryMock = jest.fn()
const updateItemMock = jest.fn()

// 2. Mock modules
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  query: queryMock,
  updateItem: updateItemMock,
  deleteItem: jest.fn(),  // Inline mock for unused functions
  scan: jest.fn()
}))

// 3. Import fixtures
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {default: queryResponse} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})

// 4. Import handler LAST
const {handler} = await import('./../src')
```

### ElectroDB Entity Mocking

**CRITICAL**: Always use the `createElectroDBEntityMock` helper for mocking ElectroDB entities.

```typescript
// 1. Import the helper
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'

// 2. Create entity mocks with appropriate query indexes
const filesMock = createElectroDBEntityMock({queryIndexes: ['byStatus']})
const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser', 'byFile']})
const usersMock = createElectroDBEntityMock()

// 3. Mock the entity modules
jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: filesMock.entity
}))
jest.unstable_mockModule('../../../entities/UserFiles', () => ({
  UserFiles: userFilesMock.entity
}))
jest.unstable_mockModule('../../../entities/Users', () => ({
  Users: usersMock.entity
}))

// 4. Import handler AFTER mocking
const {handler} = await import('../src')

// 5. Set return values in tests
beforeEach(() => {
  // Direct promise returns (no .go())
  filesMock.mocks.get.mockResolvedValue({data: testFile})
  filesMock.mocks.create.mockResolvedValue({data: newFile})

  // Method chaining with .go()
  filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: [file1, file2]})
  userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: userFiles})
})
```

**Key Rules**:
- NEVER create manual mocks for ElectroDB entities
- Always specify the correct query indexes when creating mocks
- Remember which operations use `.go()` (scan, query, upsert, update) vs direct promises (get, create, delete)

### AWS X-Ray Mocking

AWS X-Ray SDK creates a transitive dependency challenge in Jest ES modules. When vendor files import from `lib/vendor/AWS/clients.ts`, that file imports `aws-xray-sdk-core`, which must be mocked before Jest validates module paths.

**Current Solution: Lazy Initialization**

All vendor files use lazy initialization to defer client creation until first use:

```typescript
// lib/vendor/AWS/DynamoDB.ts
let docClient: DynamoDBDocument | null = null
function getDocClient(): DynamoDBDocument {
  if (!docClient) {
    const client = createDynamoDBClient()
    docClient = DynamoDBDocument.from(client)
  }
  return docClient
}

export function query(params: QueryCommandInput) {
  return getDocClient().query(params)
}
```

This pattern:
- Avoids module-level client instantiation
- Prevents `aws-xray-sdk-core` from loading during Jest module validation
- Maintains singleton pattern (client cached after first creation)
- Works with existing test mocks without modification

**setupFilesAfterEnv Configuration**

The `setupFilesAfterEnv` option in `jest.config.mjs` must remain commented out:

```javascript
// setupFilesAfterEnv: [],  // KEEP COMMENTED - causes module resolution issues with X-Ray
```

Tests import `jest-setup.ts` directly for utilities, making global setup unnecessary. Enabling `setupFilesAfterEnv` causes Jest to load `jest-setup.ts` globally, interfering with module resolution for X-Ray dependencies.

**Future Improvements**

See `.github/ISSUE_TEMPLATE/xray-testing-improvements.md` for:
- Alternative approaches explored
- Jest limitations with ES modules
- Potential solutions in future Jest versions
- Migration considerations for test frameworks with better ESM support

**Key Takeaway:** With lazy initialization in vendor files, NO additional X-Ray mocking is required in test files. The existing vendor mocks handle everything.

## Test Structure

### Describe Block

Use the Lambda function name with # prefix:

```typescript
describe('#ListFiles', () => {
  // tests
})

describe('#RegisterDevice', () => {
  // tests
})
```

### Test Setup

Always use `beforeEach` for environment and mock reset:

```typescript
describe('#FunctionName', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent

  beforeEach(() => {
    // Deep clone event to prevent test interference
    event = JSON.parse(JSON.stringify(eventMock))

    // Reset mocks
    jest.clearAllMocks()

    // Set environment variables
    process.env.DynamoDBTableFiles = 'Files'
    process.env.Bucket = 'test-bucket'

    // Set default mock responses
    queryMock.mockReturnValue(defaultResponse)
  })
})
```

## Test Naming Conventions

### 🚨 CRITICAL: Use-Case Focused vs Implementation-Focused

**Test descriptions MUST focus on the behavior being tested, NOT the implementation details.**

#### ❌ BAD: Implementation-Focused Descriptions

These descriptions expose internal implementation and become outdated when refactoring:

```typescript
// DON'T describe which service/method is being called
test('ElectroDB UserFiles.query.byUser', async () => {})
test('ElectroDB Files.get (batch)', async () => {})
test('AWS.DynamoDB.DocumentClient.query', async () => {})
test('AWS.SNS.createPlatformEndpoint', async () => {})
test('getUserDevices fails', async () => {})
test('Devices.get (batch) fails', async () => {})
test('AWS.ApiGateway.getApiKeys', async () => {})
test('APNS.Failure', async () => {})
```

**Problems with implementation-focused names:**
- Break when you refactor from DynamoDB to ElectroDB
- Break when you switch from individual queries to batch queries
- Don't describe what the test actually validates
- Make it unclear what behavior is being protected

#### ✅ GOOD: Use-Case Focused Descriptions

These descriptions explain what scenario is being tested and what outcome is expected:

```typescript
// DO describe the scenario and expected behavior
test('should return empty list when user has no files', async () => {})
test('should return 500 error when batch file retrieval fails', async () => {})
test('should throw error when API key retrieval fails', async () => {})
test('should throw error when usage plan retrieval fails', async () => {})
test('should return 500 error when user device retrieval fails', async () => {})
test('should return 500 error when batch device retrieval fails', async () => {})
test('should throw error when device scan fails', async () => {})
test('should throw error when APNS health check returns unexpected error', async () => {})
```

**Benefits of use-case focused names:**
- Survive refactoring (implementation can change, behavior stays the same)
- Self-documenting (you know what's being tested without reading the code)
- Business value focused (describes what the user experiences)
- Easier to identify missing test coverage

### Describe Block Pattern

**Always use the Lambda function name with # prefix:**

```typescript
describe('#ListFiles', () => {
  // tests
})

describe('#RegisterDevice', () => {
  // tests
})

describe('#WebhookFeedly', () => {
  // tests
})
```

**NEVER use generic or file-based names:**

```typescript
// BAD - generic name
describe('Lambda Tests', () => {})

// BAD - file path
describe('src/lambdas/ListFiles/src/index', () => {})
```

### State-Based Test Names

Use parenthetical indicators for user state:

```typescript
test('(anonymous) should list only the default file', async () => {})
test('(authenticated) should return user files', async () => {})
test('(unauthenticated) should return 401 error', async () => {})
test('(authenticated-first) should create endpoint and unsubscribe from anonymous topic', async () => {})
test('(authenticated-subsequent) should verify device already exists and return', async () => {})
```

### Action-Based Test Names

Describe what the test verifies using "should" statements:

```typescript
test('should handle missing bucket environment variable', async () => {})
test('should return empty list when user has no files', async () => {})
test('should return 500 error when file query fails', async () => {})
test('should continue even if DynamoDB update fails during error handling', async () => {})
```

### Nested Describe Blocks for Error Cases

Group AWS service failures under `#AWSFailure`:

```typescript
describe('#ListFiles', () => {
  // ... happy path tests

  describe('#AWSFailure', () => {
    test('should return empty list when user has no files', async () => {})
    test('should return 500 error when batch file retrieval fails', async () => {})
  })
})
```

Group external service failures (APNS, GitHub, etc.) under their own sections:

```typescript
describe('#PruneDevices', () => {
  // ... happy path tests

  describe('#AWSFailure', () => {
    test('should throw error when device scan fails', async () => {})
  })

  describe('#APNSFailure', () => {
    test('should throw error when APNS health check returns unexpected error', async () => {})
  })
})
```

## Response Testing Pattern

### API Gateway Responses

Parse and verify response structure:

```typescript
const output = await handler(event, context)

// Check status code
expect(output.statusCode).toEqual(200)

// Parse body
const body = JSON.parse(output.body)

// For success responses with lambda-helpers response()
expect(body.body.keyCount).toEqual(1)
expect(body.body.contents[0]).toHaveProperty('authorName')

// For error responses
expect(Object.keys(body)).toEqual(expect.arrayContaining(['error', 'requestId']))
```

### Lambda-to-Lambda Responses

```typescript
const output = await handler(event, testContext)

expect(output.statusCode).toEqual(200)
const parsedBody = JSON.parse(output.body)
expect(parsedBody.body.status).toEqual('success')
expect(parsedBody.body.fileSize).toEqual(82784319)
```

## Mock Verification Patterns

### Call Count Verification

```typescript
expect(updateItemMock).toHaveBeenCalledTimes(2)
expect(streamVideoToS3Mock).not.toHaveBeenCalled()
```

### Call Parameter Verification

```typescript
// Use @ts-expect-error for mock.calls type issues
// @ts-expect-error - mock.calls type inference issue
const firstCall = updateItemMock.mock.calls[0][0] as Record<string, unknown>
expect(firstCall.ExpressionAttributeValues).toMatchObject({':status': FileStatus.PendingDownload})

// For function call matching
expect(streamVideoToS3Mock).toHaveBeenCalledWith(
  expect.stringContaining('youtube.com/watch?v='),
  expect.anything(),  // For complex objects
  'test-bucket',
  expect.stringMatching(/\.mp4$/)
)
```

## Fixture Management

### Loading Fixtures

Always use dynamic imports with JSON assertion:

```typescript
const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {default: queryResponse} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})
```

### Fixture Naming Convention

Name fixtures with HTTP status codes when applicable:

```
fixtures/
  APIGatewayEvent.json
  query-200-OK.json
  query-200-Empty.json
  batchGet-200-OK.json
  batchGet-200-Filtered.json
  createPlatformEndpoint-200-OK.json
  query-201-Created.json
```

## Error Testing

### AWS Service Failures

Group AWS failures in nested describe block with use-case focused names:

```typescript
describe('#AWSFailure', () => {
  test('should return 500 error when user file query fails', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    queryMock.mockReturnValue(undefined)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)
  })

  test('should return 500 error when platform endpoint creation fails', async () => {
    createPlatformEndpointMock.mockReturnValue(undefined)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)
  })

  test('should throw error when API key retrieval fails', async () => {
    getApiKeysMock.mockReturnValue(undefined)
    await expect(handler(event, testContext)).rejects.toThrow(UnexpectedError)
  })
})
```

### Exception Testing

Use descriptive names that explain what scenario causes the exception:

```typescript
test('should return 401 error when authentication query throws exception', async () => {
  queryMock.mockImplementation(() => {
    throw new Error('Database connection failed')
  })
  const output = await handler(event, context)
  expect(output.statusCode).toEqual(401)
})

test('should throw error when APNS health check returns unexpected error', async () => {
  sendMock.mockImplementation(() => {
    throw undefined  // Simulate unexpected APNS failure
  })
  await expect(handler(event, context)).rejects.toThrow(UnexpectedError)
})
```

## Event Manipulation

### Modifying Events

```typescript
// Remove headers
delete event.headers['X-User-Id']
delete event.headers['Authorization']

// Set principal ID
event.requestContext.authorizer!.principalId = fakeUserId

// Change body
event.body = '{}'

// Non-null assertion for TypeScript
event.requestContext.authorizer!.principalId = 'unknown'
```

### Environment Variable Testing

Save and restore when testing missing env vars:

```typescript
test('should handle missing bucket environment variable', async () => {
  const originalBucket = process.env.Bucket
  process.env.Bucket = ''

  // ... test logic

  process.env.Bucket = originalBucket
})
```

## Mock Response Patterns

### Simple Mock Returns

```typescript
jest.unstable_mockModule('../../../lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: jest.fn().mockReturnValue({
    ResponseMetadata: {
      RequestId: uuidv4()
    }
  }),
  subscribe: jest.fn().mockReturnValue(subscribeResponse)
}))
```

### Variable Mock Returns

```typescript
beforeEach(() => {
  queryMock.mockReturnValue(defaultResponse)
  createPlatformEndpointMock.mockReturnValue(createPlatformEndpointResponse)
})

test('specific test', async () => {
  queryMock.mockReturnValue(specificResponse)  // Override for this test
  // ... test logic
})
```

## TypeScript Handling

### Type Assertions in Tests

```typescript
// Cast event types
const event = eventMock as StartFileUploadParams

// Cast response data
const userDevice = userResponse.Items[0] as DynamoDBUserDevice

// Handle mock.calls type issues
// @ts-expect-error - mock.calls type inference issue
const firstCall = updateItemMock.mock.calls[0][0] as Record<string, unknown>
```

### Mock Type Definitions

```typescript
// Define mock function types when needed
const fetchVideoInfoMock = jest.fn<() => Promise<unknown>>()
const chooseVideoFormatMock = jest.fn<() => unknown>()
const streamVideoToS3Mock = jest.fn<() => Promise<{fileSize: number; s3Url: string; duration: number}>>()
```

## Data Preparation

### Set to Array Conversion

When fixtures contain Sets that need array conversion:

```typescript
if (Array.isArray(queryStubReturnObject.Items)) {
  queryStubReturnObject.Items[0].fileId = Array.from(new Set(queryStubReturnObject.Items[0].fileId))
}
```

### Deep Cloning

Always deep clone events to prevent test interference:

```typescript
beforeEach(() => {
  event = JSON.parse(JSON.stringify(eventMock))
})
```

## Assertion Patterns

### Object Key Verification

```typescript
expect(Object.keys(body.body)).toEqual(expect.arrayContaining(['keyCount', 'contents']))
```

### Property Existence

```typescript
expect(body.body.contents[0]).toHaveProperty('authorName')
expect(body.body).toHaveProperty('endpointArn')
```

### Array Length

```typescript
expect(Array.from(body.error.message.token).length).toEqual(1)
```

### Value Type Checking

```typescript
expect(typeof body.error.message).toEqual('object')
```

### Flexible Comparisons

```typescript
expect(output.statusCode).toBeGreaterThanOrEqual(400)
```

## Test Coverage Guidelines

### Required Test Cases

1. **Happy path** - Normal successful execution
2. **State variations** - Anonymous, authenticated, unauthenticated
3. **Empty/null responses** - Handle empty arrays, undefined values
4. **AWS service failures** - Test each AWS service mock returning undefined/error
5. **Validation failures** - Missing required fields, invalid data
6. **Environment issues** - Missing environment variables
7. **Error recovery** - Continue processing despite individual failures

### Test Organization

- Group related tests together
- Use descriptive test names
- Separate AWS failure tests in nested describe block
- Test both success and failure paths
- Verify mock interactions, not just outputs

## Coverage Pragmas for Vendor Wrappers

### When to Use c8 ignore

Use `/* c8 ignore start */` / `/* c8 ignore stop */` comments for pure AWS SDK wrappers that:
1. Contain no business logic
2. Only create a command and call `.send()`
3. Are already tested via integration tests

**Rationale:**
- Coverage metrics should focus on code with actual logic
- Integration tests already verify these wrappers work with LocalStack
- Unit testing pure wrappers provides no value (tests that mocking works, not that code works)

**Note:** We use c8 syntax because Jest is configured with `coverageProvider: 'v8'`

### Pattern

```typescript
/* c8 ignore start - Pure AWS SDK wrapper, tested via integration tests */
export function query(params: QueryCommandInput) {
  return docClient.query(params)
}
/* c8 ignore stop */

/* c8 ignore start - Thin wrapper with minimal logic, tested via integration tests */
export async function invokeAsync(functionName: string, payload: Record<string, unknown>): Promise<InvokeCommandOutput> {
  const params: InvokeCommandInput = {
    FunctionName: functionName,
    InvocationType: 'Event',
    Payload: JSON.stringify(payload)
  }
  return invokeLambda(params)
}
/* c8 ignore stop */
```

### When NOT to Use c8 ignore

Do NOT use coverage pragmas for functions with:
- Business logic or validation
- Error transformation
- Parameter manipulation beyond simple defaults
- Conditional branching
- Data transformation

**Example of code that SHOULD be tested:**
```typescript
// Has validation logic - SHOULD be tested
export function transformData(input: unknown): string {
  if (typeof input === 'string') {
    return input
  } else if (Array.isArray(input)) {
    return input.map(s => transformData(s)).join(', ')
  }
  return 'Unknown'
}
```

### Files with Coverage Pragmas

Currently excluded from coverage:
- `src/lib/vendor/AWS/SNS.ts` - All 6 functions (pure wrappers)
- `src/lib/vendor/AWS/Lambda.ts` - Both functions (pure/thin wrappers)
- `src/lib/vendor/AWS/DynamoDB.ts` - All 6 functions (pure wrappers)
- `src/lib/vendor/AWS/S3.ts` - Both functions (pure/thin wrappers)

## Common Patterns to Avoid

1. **Don't use implementation-focused test names** - Use "should return 500 error when file query fails", NOT "ElectroDB Files.get fails"
2. **Don't test implementation details** - Test behavior, not internal function calls
3. **Don't use await expect().rejects.toThrow()** for API Gateway handlers - Check statusCode instead
4. **Don't forget to reset mocks** - Use jest.clearAllMocks() in beforeEach
5. **Don't modify shared fixtures** - Deep clone before modification
6. **Don't skip error scenarios** - Test all failure modes
7. **Don't mock logging functions** - Let logDebug, logInfo, logError run naturally
8. **Don't use `unknown` when types are known** - Use specific types for mocks

## Type-Safe Mocking

### Use Specific Types for Mock Functions

```typescript
// BAD - using unknown
const fetchVideoInfoMock = jest.fn<() => Promise<unknown>>()
const chooseVideoFormatMock = jest.fn<() => unknown>()

// GOOD - using specific types
import {YtDlpVideoInfo, YtDlpFormat} from '../../../types/youtube'
const fetchVideoInfoMock = jest.fn<() => Promise<YtDlpVideoInfo>>()
const chooseVideoFormatMock = jest.fn<() => YtDlpFormat>()
```

### Mock Return Types Should Match Function Signatures

```typescript
// If the actual function returns Promise<{StatusCode: number}>
const sendMock = jest.fn<() => Promise<{StatusCode: number}>>()
  .mockResolvedValue({StatusCode: 202})
```

## Fixture Best Practices

### Large Test Data in Fixtures

```typescript
// BAD - large inline object
const videoInfo = {
  id: 'test-id',
  title: 'Test Video',
  formats: [/* ... 50 lines of data ... */]
}

// GOOD - import from fixture
const {default: videoInfo} = await import('./fixtures/videoInfo.json', {assert: {type: 'json'}})
```

### Reuse Fixtures Across Tests

Create common fixtures that can be imported and modified as needed rather than duplicating data in multiple tests.