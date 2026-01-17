# Vitest Mocking Strategy

## Quick Reference
- **When to use**: Writing unit tests with ES modules
- **Enforcement**: Required
- **Impact if violated**: HIGH - Obscure test failures

## The Problem

In ES modules, **ALL module-level code executes when ANY export is imported**. Missing mocks for transitive dependencies cause mysterious 500 errors.

```typescript
// YouTube.ts
import YTDlpWrap from 'yt-dlp-wrap'  // Executes even if unused
import {spawn} from 'child_process'  // Executes

export function getVideoID(url: string) { }  // What you imported
export function streamVideoToS3() { }        // Uses the above imports
```

When testing `getVideoID`, all imports execute. Solution: Mock ALL transitive dependencies.

## Mocking Pattern

```typescript
// test/index.test.ts
import {describe, expect, vi, test} from 'vitest'

// 1. Mock ALL transitive dependencies BEFORE imports
vi.mock('yt-dlp-wrap', () => ({
  default: vi.fn()
}))

vi.mock('child_process', () => ({
  spawn: vi.fn()
}))

vi.mock('../../../lib/vendor/AWS/S3', () => ({
  createS3Upload: vi.fn()
}))

// 2. Import after mocking
const {handler} = await import('../src/index')

// 3. Use type imports for mocks
import type {Mock} from 'vitest'
const mockYTDlp = (await import('yt-dlp-wrap')).default as Mock
```

## Dependency Mapping

1. **Map direct imports** - What does your test file import?
2. **Map transitive imports** - What do those imports import?
3. **Mock all external deps** - AWS SDK, npm packages, vendor wrappers
4. **Match module structure** - Classes need constructor mocks

## Common Patterns

### AWS SDK Mocks (aws-sdk-client-mock)

The preferred approach for AWS SDK mocking uses `aws-sdk-client-mock` with `aws-sdk-client-mock-vitest` for type-safe assertions:

```typescript
import {mockClient} from 'aws-sdk-client-mock'
import {SNSClient, PublishCommand} from '@aws-sdk/client-sns'
import {createSNSMock} from '#test/helpers/aws-sdk-mock'

// Option 1: Use the helper (recommended - integrates with vendor wrappers)
const snsMock = createSNSMock()

// Option 2: Direct mockClient (for simple cases)
const snsMock = mockClient(SNSClient)

beforeEach(() => {
  snsMock.reset()
  snsMock.on(PublishCommand).resolves({MessageId: 'msg-123'})
})

// Type-safe assertions
expect(snsMock).toHaveReceivedCommand(PublishCommand)
expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
  TopicArn: expect.stringContaining('notifications'),
  Message: expect.any(String)
})
```

**Benefits**:
- Type-safe command matching
- Assertion matchers for Vitest (toHaveReceivedCommand, toHaveReceivedCommandWith)
- Works with the vendor wrapper architecture via test client injection

### Legacy AWS SDK Mocks (vi.mock)

For simpler cases or backward compatibility:

```typescript
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({
    send: vi.fn()
  }))
}))
```

### Vendor Wrapper Mocks
```typescript
vi.mock('../../../lib/vendor/AWS/DynamoDB', () => ({
  getDynamoDbClient: vi.fn(),
  queryItems: vi.fn()
}))
```

### Entity Query Mocking

Mock entity query functions from `#entities/queries`:

```typescript
import {vi, describe, test, expect, beforeEach} from 'vitest'
import {createMockFile, createMockUser} from '#test/helpers/entity-fixtures'

// Mock entity queries
vi.mock('#entities/queries', () => ({
  getFilesForUser: vi.fn(),
  getUser: vi.fn(),
  updateFile: vi.fn()
}))

// Import mocked functions
import {getFilesForUser, getUser, updateFile} from '#entities/queries'

beforeEach(() => {
  vi.clearAllMocks()
})

test('lists files for user', async () => {
  const mockFiles = [createMockFile({status: 'Downloaded'})]
  vi.mocked(getFilesForUser).mockResolvedValue(mockFiles)

  const result = await handler(event, context)

  expect(getFilesForUser).toHaveBeenCalledWith('user-123')
  expect(result.statusCode).toBe(200)
})
```

**Key patterns**:
- Mock `#entities/queries`, not individual entity modules
- Use `vi.mocked()` for type-safe mock setup
- Use entity fixtures from `#test/helpers/entity-fixtures`

## Typed Event Factories

Use typed event factories instead of JSON fixture files for creating Lambda events. Located at `test/helpers/event-factories.ts`:

```typescript
import {createAPIGatewayEvent, createSQSEvent, createS3Event} from '#test/helpers/event-factories'
import {createRegisterDeviceBody, createFeedlyWebhookBody} from '#test/helpers/event-factories'

// API Gateway events with full type safety
const event = createAPIGatewayEvent({
  path: '/registerDevice',
  httpMethod: 'POST',
  body: createRegisterDeviceBody({token: 'test-token'}),
  userId: 'user-123'  // Sets authenticated user
})

// SQS events for queue-triggered Lambdas
const sqsEvent = createDownloadQueueEvent('video-id', {
  correlationId: 'corr-123',
  userId: 'user-123'
})

// S3 events for bucket-triggered Lambdas
const s3Event = createS3Event({
  records: [{key: 'videos/test.mp4', bucket: 'my-bucket'}]
})
```

### Available Factories

| Factory | Usage |
|---------|-------|
| `createAPIGatewayEvent()` | Authenticated API Gateway events |
| `createSQSEvent()` | Generic SQS batch events |
| `createDownloadQueueEvent()` | StartFileUpload queue messages |
| `createPushNotificationEvent()` | SendPushNotification messages |
| `createS3Event()` | S3 object events |
| `createScheduledEvent()` | CloudWatch/EventBridge scheduled events |
| `createApiGatewayAuthorizerEvent()` | Custom authorizer REQUEST event |
| `createCloudFrontRequestEvent()` | Lambda@Edge origin-request event |
| `createRegisterDeviceBody()` | RegisterDevice request body |
| `createSubscribeBody()` | UserSubscribe request body |
| `createFeedlyWebhookBody()` | Feedly webhook request body |

### Authentication Patterns

```typescript
// Authenticated user (default when userId provided)
const authenticatedEvent = createAPIGatewayEvent({userId: 'user-123'})

// Unauthenticated (Authorization header present but invalid)
const unauthEvent = createAPIGatewayEvent({})
unauthEvent.requestContext.authorizer!.principalId = 'unknown'

// Anonymous (no Authorization header)
const anonEvent = createAPIGatewayEvent({})
delete anonEvent.headers.Authorization
anonEvent.requestContext.authorizer!.principalId = 'unknown'
```

**Benefits**:
- Full TypeScript type inference
- Consistent test data across all Lambda tests
- No JSON fixture file maintenance
- Clear authentication state handling

## Testing Checklist

- [ ] List all imports in test file
- [ ] Read source files, list their imports
- [ ] Mock ALL external dependencies
- [ ] Mock BEFORE importing handler
- [ ] Add TypeScript types to mocks
- [ ] Use typed event factories (not JSON fixtures)
- [ ] Test locally AND in CI

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| Cannot find module | Missing mock | Add vi.mock |
| X is not a constructor | Wrong mock structure | Mock as class with constructor |
| Property X doesn't exist | Incomplete mock | Add missing properties |
| Works locally, fails CI | Environment differences | Mock all transitive deps |

## Mock Reset Pattern (Required)

All test files MUST follow this pattern for consistent mock state:

```typescript
// Module-level mock creation
const sqsMock = mockClient(SQSClient)

beforeEach(() => {
  vi.clearAllMocks()  // Reset all vi.fn() mocks
  // Configure default mock responses...
  sqsMock.on(SendMessageCommand).resolves(createSQSSendMessageResponse())
})

afterEach(() => {
  sqsMock.reset()     // Reset aws-sdk-client-mock instances
})

afterAll(() => {
  resetAllAwsMocks()  // Clean up test client injection
})
```

**Rationale**:
- `vi.clearAllMocks()` in beforeEach resets Vitest mocks before each test
- AWS mock `reset()` in afterEach only - NOT in beforeEach (avoids redundant reset)
- `resetAllAwsMocks()` in afterAll cleans up vendor wrapper injection
- Configure mock responses AFTER clearing, in beforeEach

**Common mistakes**:
- Resetting AWS mocks in BOTH beforeEach AND afterEach (redundant, wastes cycles)
- Forgetting `vi.clearAllMocks()` in beforeEach (vi.fn() mocks retain state)
- Not using `afterAll` to clean up vendor wrapper injection
- Putting `vi.clearAllMocks()` in afterEach instead of beforeEach

## Best Practices

1. **Mock first, import second** - Always mock before importing
2. **Mock everything external** - All npm packages and AWS SDK
3. **Use type assertions** - Add proper types to mocks
4. **Use mock helpers** - Entity fixtures for test data, AWS SDK mock helpers for AWS services
5. **Map dependencies** - Trace all transitive imports
6. **Prefer aws-sdk-client-mock** - For AWS SDK v3 clients, use `aws-sdk-client-mock` for type-safe assertions
7. **Reset pattern** - Use `vi.clearAllMocks()` in beforeEach, `awsMock.reset()` in afterEach only
8. **Prefer `toHaveReceivedCommandWith`** - Verify AWS SDK call parameters, not just command existence
9. **Use fixture constants** - Import `DEFAULT_USER_ID`, `DEFAULT_SESSION_ID` from entity-fixtures instead of generating random UUIDs
10. **Test behavior, not implementation** - Avoid `vi.spyOn` on standard library prototypes; verify outputs instead

## Anti-Patterns to Avoid

### spyOn on Standard Library Prototypes

```typescript
// BAD: Testing implementation details
vi.spyOn(URLSearchParams.prototype, 'has')
vi.spyOn(URLSearchParams.prototype, 'get')
expect(URLSearchParams.prototype.has).toHaveBeenCalledWith('ApiKey')

// GOOD: Test behavior via outputs
const result = await handler(event, context)
expect(result.headers!['x-api-key'][0].value).toEqual(expectedApiKey)
```

### Random UUIDs in Tests

```typescript
// BAD: Random values each test run
const fakeUserId = uuidv4()
const fakeSessionId = uuidv4()

// GOOD: Consistent fixture constants
import {DEFAULT_USER_ID, DEFAULT_SESSION_ID} from '#test/helpers/entity-fixtures'
const fakeUserId = DEFAULT_USER_ID
const fakeSessionId = DEFAULT_SESSION_ID
```

## AWS SDK Mock Utilities

Located at `test/helpers/aws-sdk-mock.ts`:

| Function | Description |
|----------|-------------|
| `createS3Mock()` | Mock S3 client with vendor injection |
| `createSQSMock()` | Mock SQS client with vendor injection |
| `createSNSMock()` | Mock SNS client with vendor injection |
| `createEventBridgeMock()` | Mock EventBridge client with vendor injection |
| `createDynamoDBMock()` | Mock DynamoDB client with vendor injection |
| `createLambdaMock()` | Mock Lambda client with vendor injection |
| `resetAllAwsMocks()` | Reset and clear all mock injections |

These helpers integrate with the vendor wrapper architecture by injecting mock clients into `src/lib/vendor/AWS/clients.ts`.

## Entity Fixtures

Factory functions for creating mock entity rows in tests. Located at `test/helpers/entity-fixtures.ts`:

```typescript
import {createMockFile, createMockDevice, createMockUser} from '#test/helpers/entity-fixtures'
import {createMockUserFile, createMockSession, createMockFileDownload} from '#test/helpers/entity-fixtures'

// All defaults
const file = createMockFile()
const device = createMockDevice()
const user = createMockUser()

// Override specific fields
const failedFile = createMockFile({status: 'Failed', size: 0})
const customDevice = createMockDevice({name: "User's iPad", systemName: 'iPadOS'})
const unverifiedUser = createMockUser({emailVerified: false})

// Relationship entities
const userFile = createMockUserFile({userId: 'user-123', fileId: 'file-456'})
const session = createMockSession()
const download = createMockFileDownload({status: 'Failed', lastError: 'Network timeout'})

// Batch creation
const files = createMockFiles(3)  // Creates 3 files with IDs file-1, file-2, file-3
const devices = createMockDevices(2)  // Creates 2 devices
```

### Available Factories

| Factory | Default Entity | Common Overrides |
|---------|---------------|------------------|
| `createMockFile()` | Downloaded video | `status`, `fileId`, `size` |
| `createMockDevice()` | iPhone with APNS | `deviceId`, `name`, `token` |
| `createMockUser()` | Verified Apple user | `id`, `email`, `emailVerified` |
| `createMockUserFile()` | User-file link | `userId`, `fileId` |
| `createMockUserDevice()` | User-device link | `userId`, `deviceId` |
| `createMockSession()` | Valid session (24h) | `expiresAt`, `userId` |
| `createMockFileDownload()` | Pending download | `status`, `retryCount`, `lastError` |
| `createMockAccount()` | Apple OAuth account | `userId`, `providerId`, `accessToken` |
| `createMockVerification()` | Verification token (24h) | `identifier`, `expiresAt` |
| `createMockFiles(n)` | Multiple files | `status` (applied to all) |
| `createMockDevices(n)` | Multiple devices | `name` (applied to all) |

**Benefits**:
- Type-safe with full inference from row types
- Sensible defaults matching production data shapes
- Composable overrides for specific test scenarios

## AWS Response Factories

Factory functions for creating AWS SDK response objects. Located at `test/helpers/aws-response-factories.ts`:

```typescript
import {createSNSPublishResponse, createSNSSubscribeResponse} from '#test/helpers/aws-response-factories'
import {createSQSSendMessageResponse, createEventBridgePutEventsResponse} from '#test/helpers/aws-response-factories'

// Configure mock responses
snsMock.on(PublishCommand).resolves(createSNSPublishResponse())
snsMock.on(SubscribeCommand).resolves(createSNSSubscribeResponse())
sqsMock.on(SendMessageCommand).resolves(createSQSSendMessageResponse())
eventBridgeMock.on(PutEventsCommand).resolves(createEventBridgePutEventsResponse())

// Custom message IDs
snsMock.on(PublishCommand).resolves(createSNSPublishResponse({messageId: 'custom-id'}))

// Error scenarios
eventBridgeMock.on(PutEventsCommand).resolves(
  createEventBridgePutEventsFailureResponse('EventBridge failure')
)
```

### Available Factories

| Factory | Service | Response Type |
|---------|---------|---------------|
| `createSNSPublishResponse()` | SNS | PublishCommand result |
| `createSNSSubscribeResponse()` | SNS | SubscribeCommand result |
| `createSNSMetadataResponse()` | SNS | Delete/Unsubscribe result |
| `createSNSEndpointResponse()` | SNS | CreatePlatformEndpoint result |
| `createSNSSubscriptionListResponse()` | SNS | ListSubscriptionsByTopic result |
| `createSQSSendMessageResponse()` | SQS | SendMessageCommand result |
| `createEventBridgePutEventsResponse()` | EventBridge | PutEventsCommand result |
| `createEventBridgePutEventsFailureResponse()` | EventBridge | Failed PutEvents result |
| `createGetApiKeysResponse()` | API Gateway | GetApiKeysCommand result |
| `createGetUsagePlansResponse()` | API Gateway | GetUsagePlansCommand result |
| `createGetUsageResponse()` | API Gateway | GetUsageCommand result |

**Benefits**:
- Type-safe response objects matching AWS SDK types
- Consistent across all Lambda tests using `aws-sdk-client-mock`
- Easy customization via options parameters

## Related Patterns

- [Mock Type Annotations](Mock-Type-Annotations.md) - TypeScript mock patterns
- [Lazy Initialization](Lazy-Initialization-Pattern.md) - Defer module execution
- [Coverage Philosophy](Coverage-Philosophy.md) - Test strategy

---

*Mock ALL transitive dependencies in ES modules to prevent obscure test failures.*
