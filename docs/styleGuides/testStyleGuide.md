# Lambda Test Style Guide

This document defines the testing standards and patterns for Lambda function tests.

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