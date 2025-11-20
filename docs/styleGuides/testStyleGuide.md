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

### State-Based Test Names

Use parenthetical indicators for user state:

```typescript
test('(anonymous) should list only the default file', async () => {})
test('(authenticated) should return users files', async () => {})
test('(unauthenticated) should throw an error as token is invalid', async () => {})
test('(authenticated-first) should create endpoint and unsubscribe', async () => {})
test('(authenticated-subsequent) should create endpoint and return', async () => {})
```

### Action-Based Test Names

Describe what the test verifies:

```typescript
test('should handle missing bucket environment variable', async () => {})
test('should gracefully handle an empty list', async () => {})
test('should fail gracefully if query fails', async () => {})
test('should continue even if DynamoDB update fails during error handling', async () => {})
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

### Fixture Sources

This project uses two types of fixtures:

**1. Production-Extracted Fixtures (Preferred)**

Automatically extracted from CloudWatch Logs using the fixture extraction system:
- Located in `test/fixtures/` with `-production` or `-extracted` suffix
- Always match real production payloads
- Automatically sanitized (tokens, user IDs redacted)
- Updated weekly or on-demand

**2. Hand-Crafted Fixtures (Legacy/Edge Cases)**

Manually created for edge cases not seen in production:
- Located in `test/fixtures/` with descriptive names
- Used for error scenarios, boundary conditions
- Maintained manually when API contracts change

### Loading Fixtures

Always use dynamic imports with JSON assertion:

```typescript
// Production-extracted fixture (preferred)
const {default: eventMock} = await import('./fixtures/APIGatewayEvent-production.json', {assert: {type: 'json'}})

// Hand-crafted fixture (for edge cases)
const {default: queryResponse} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})
```

### Fixture Naming Convention

**Production-Extracted Fixtures:**
```
fixtures/
  APIGatewayEvent-production.json          # Real production event
  APIGatewayResponse-production.json       # Real production response
  DynamoDB-query-production.json           # Real DynamoDB query response
  S3-putObject-production.json             # Real S3 response
```

**Hand-Crafted Fixtures:**
```
fixtures/
  APIGatewayEvent.json                     # Base event template
  query-200-OK.json                        # Success case
  query-200-Empty.json                     # Empty result
  batchGet-200-Filtered.json               # Filtered results
  createPlatformEndpoint-200-OK.json       # SNS endpoint creation
  query-201-Created.json                   # Resource creation
```

### Updating Fixtures

**For production-extracted fixtures:**
1. Run extraction script: `./bin/extract-fixtures.sh WebhookFeedly 7`
2. Process results: `node bin/process-fixture-markers.js`
3. Review extracted fixtures in `test/fixtures/extracted/`
4. Move validated fixtures to `test/fixtures/`
5. Update tests to use new fixtures

**For hand-crafted fixtures:**
1. Update JSON file manually
2. Verify structure matches current API contract
3. Run tests to ensure compatibility
4. Consider if this scenario appears in production (if so, extract instead)

### Fixture Extraction Workflow

See [docs/FIXTURE_EXTRACTION_RUNBOOK.md](../FIXTURE_EXTRACTION_RUNBOOK.md) for detailed extraction instructions.

## Error Testing

### AWS Service Failures

Group AWS failures in nested describe block:

```typescript
describe('#AWSFailure', () => {
  test('AWS.DynamoDB.DocumentClient.query', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    queryMock.mockReturnValue(undefined)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)
  })

  test('AWS.SNS.createPlatformEndpoint', async () => {
    createPlatformEndpointMock.mockReturnValue(undefined)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)
  })
})
```

### Exception Testing

```typescript
test('should fail gracefully if query fails', async () => {
  queryMock.mockImplementation(() => {
    throw new Error()
  })
  const output = await handler(event, context)
  expect(output.statusCode).toEqual(401)
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

1. **Don't test implementation details** - Test behavior, not internal function calls
2. **Don't use await expect().rejects.toThrow()** for API Gateway handlers - Check statusCode instead
3. **Don't forget to reset mocks** - Use jest.clearAllMocks() in beforeEach
4. **Don't modify shared fixtures** - Deep clone before modification
5. **Don't skip error scenarios** - Test all failure modes
6. **Don't mock logging functions** - Let logDebug, logInfo, logError run naturally
7. **Don't use `unknown` when types are known** - Use specific types for mocks

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