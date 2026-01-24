# Mocking Patterns Analysis

> Generated: 2025-12-30
> Last Updated: 2025-12-30

This document analyzes the current mocking patterns used in the codebase and compares them with the `aws-sdk-client-mock` approach.

## Current Architecture

### Vendor Encapsulation Policy

The codebase follows a strict **Vendor Encapsulation Policy** where all third-party library access is wrapped:

```
Application Code → Vendor Wrapper → Third-Party Library
```

This means:
- Lambda handlers import from `#lib/vendor/AWS/SQS`, not `@aws-sdk/client-sqs`
- Tests mock the vendor wrappers, not the underlying SDK clients
- Changing vendors requires only updating the wrapper, not all consumers

### AWS Vendor Wrappers

**Location:** `src/lib/vendor/AWS/`

| File | AWS Service | Wrapped Functions |
|------|-------------|-------------------|
| `S3.ts` | S3 | `headObject()`, `createS3Upload()` |
| `SQS.ts` | SQS | `sendMessage()`, `stringAttribute()`, `numberAttribute()` |
| `SNS.ts` | SNS | `createPlatformEndpoint()`, `subscribe()`, `unsubscribe()`, `deleteEndpoint()`, `listSubscriptionsByTopic()`, `publish()` |
| `EventBridge.ts` | EventBridge | `publishEvent()` |
| `clients.ts` | All | `createS3Client()`, `createSQSClient()`, `createSNSClient()`, `createEventBridgeClient()`, etc. |

---

## Current Mocking Patterns

### Pattern 1: Vendor Wrapper Mocking

**When to use:** Lambda handler tests that call AWS services

```typescript
// Example from RegisterDevice test
vi.mock('#lib/vendor/AWS/SNS', () => ({
  deleteEndpoint: vi.fn().mockReturnValue({ResponseMetadata: {RequestId: 'uuid'}}),
  subscribe: vi.fn().mockReturnValue(subscribeResponse),
  listSubscriptionsByTopic: listSubscriptionsByTopicMock,
  createPlatformEndpoint: createPlatformEndpointMock,
  unsubscribe: vi.fn()
}))
```

**Pros:**
- Aligns with vendor encapsulation policy
- Mocks at the boundary of application code
- Simple vi.fn() usage

**Cons:**
- No type safety on mock return values
- No built-in assertions for command parameters
- Must manually track call counts and arguments

### Pattern 2: Entity Query Mocking

**When to use:** Tests that interact with database entities

```typescript
// Example from StartFileUpload test
vi.mock('#entities/queries', () => ({
  getFileDownload: vi.fn(),
  updateFileDownload: vi.fn(),
  createFileDownload: vi.fn(),
  getUserFilesByFileId: vi.fn(),
  upsertFile: vi.fn()
}))

// Set up return values
vi.mocked(getFileDownload).mockResolvedValue(null)
vi.mocked(updateFileDownload).mockResolvedValue(mockFileDownloadRow())
```

**Pros:**
- Type-safe via `vi.mocked()`
- Clear separation of database concerns
- Easy to set up different scenarios

**Cons:**
- Requires importing mocked functions after vi.mock
- Order-dependent setup

### Pattern 3: Query Function Mocking (RECOMMENDED)

**When to use:** Tests that need entity query behavior (get/create/update/delete)

```typescript
// Mock the queries module
vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn()
}))

import {getUser, createUser} from '#entities/queries'

// Set up return values using mocked functions
vi.mocked(getUser).mockResolvedValue(mockUser)
vi.mocked(createUser).mockResolvedValue(mockUser)
```

**Pros:**
- Simple, direct function mocking
- Type-safe via `vi.mocked()`
- Aligns with current Drizzle ORM architecture

**Cons:**
- Requires importing mocked functions after vi.mock
- Order-dependent setup

### Pattern 4: Better Auth Mocking

**When to use:** Authentication-related tests

```typescript
// Using createBetterAuthMock from test/helpers/better-auth-mock.ts
const betterAuthMock = createBetterAuthMock()

vi.mock('#lib/vendor/BetterAuth/config', () => ({
  auth: betterAuthMock
}))

// Set up return values
betterAuthMock.api.signInSocial.mockResolvedValue({
  token: 'test-token',
  user: mockUser
})
```

### Pattern 5: Service Layer Mocking

**When to use:** Tests that need to mock domain services

```typescript
// Example from RegisterDevice test
const getUserDevicesMock = vi.fn()
vi.mock('#lib/domain/device/device-service', () => ({
  getUserDevices: getUserDevicesMock,
  subscribeEndpointToTopic: vi.fn(),
  unsubscribeEndpointToTopic: vi.fn()
}))
```

---

## aws-sdk-client-mock Approach

### Overview

[aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock) is a library that provides type-safe mocking of AWS SDK v3 clients using Sinon stubs.

### How It Works

Instead of mocking wrapper functions, it intercepts SDK client `.send()` calls:

```typescript
import {mockClient} from 'aws-sdk-client-mock'
import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs'

const sqsMock = mockClient(SQSClient)

// Configure mock responses
sqsMock.on(SendMessageCommand).resolves({MessageId: 'msg-123'})

// Run code that uses SQS
await myFunction()

// Assert with custom matchers (aws-sdk-client-mock-vitest)
expect(sqsMock).toHaveReceivedCommand(SendMessageCommand)
expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
  QueueUrl: expect.stringContaining('MyQueue'),
  MessageBody: expect.any(String)
})
```

### Available Matchers (aws-sdk-client-mock-vitest)

| Matcher | Description |
|---------|-------------|
| `toHaveReceivedCommand(Command)` | Assert command was called |
| `toHaveReceivedCommandTimes(Command, n)` | Assert command called n times |
| `toHaveReceivedCommandWith(Command, input)` | Assert command with specific input |
| `toHaveReceivedNthCommandWith(Command, n, input)` | Assert nth call input |
| `toHaveReceivedLastCommandWith(Command, input)` | Assert last call input |
| `toHaveReceivedCommandExactlyOnceWith(Command, input)` | Assert exactly one call with input |
| `toHaveReceivedAnyCommand()` | Assert any command was called |

---

## Comparison

### Vendor Wrapper Mock vs aws-sdk-client-mock

| Aspect | Vendor Wrapper Mock | aws-sdk-client-mock |
|--------|---------------------|---------------------|
| **Type Safety** | Manual (vi.fn return types) | Built-in (SDK types) |
| **Assertion API** | Standard Vitest (toHaveBeenCalledWith) | Custom matchers (toHaveReceivedCommandWith) |
| **Setup Complexity** | Simple vi.mock | Requires mockClient setup |
| **Architecture Alignment** | Aligns with vendor encapsulation | Mocks at SDK level |
| **Error Messages** | Generic | SDK-aware, helpful |
| **Partial Matching** | Manual expect.objectContaining | Built-in support |

### Example Comparison

**Current approach (vendor wrapper mock):**
```typescript
const sendMessageMock = vi.fn().mockResolvedValue({MessageId: 'msg-123'})
vi.mock('#lib/vendor/AWS/SQS', () => ({
  sendMessage: sendMessageMock,
  stringAttribute: (v: string) => ({DataType: 'String', StringValue: v})
}))

// In test
expect(sendMessageMock).toHaveBeenCalledWith(
  expect.objectContaining({
    QueueUrl: expect.stringContaining('MyQueue'),
    MessageBody: expect.any(String)
  })
)
```

**aws-sdk-client-mock approach:**
```typescript
import {mockClient} from 'aws-sdk-client-mock'
import {SQSClient, SendMessageCommand} from '@aws-sdk/client-sqs'

const sqsMock = mockClient(SQSClient)

beforeEach(() => {
  sqsMock.reset()
  sqsMock.on(SendMessageCommand).resolves({MessageId: 'msg-123'})
})

// In test
expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
  QueueUrl: expect.stringContaining('MyQueue'),
  MessageBody: expect.any(String)
})
```

---

## Integration Strategy

### Hybrid Approach

Given the vendor encapsulation architecture, we can use aws-sdk-client-mock at the client factory level:

1. **Modify client factory** to allow test injection:

```typescript
// src/lib/vendor/AWS/clients.ts
let testSQSClient: SQSClient | null = null

export function setTestSQSClient(client: SQSClient | null): void {
  testSQSClient = client
}

export function createSQSClient(): SQSClient {
  if (testSQSClient) return testSQSClient
  // ... existing implementation
}
```

2. **Create test helper** for SDK mocking:

```typescript
// test/helpers/aws-sdk-mock.ts
import {mockClient} from 'aws-sdk-client-mock'
import {SQSClient} from '@aws-sdk/client-sqs'

export function createSQSClientMock() {
  const mock = mockClient(SQSClient)
  // Inject into client factory
  setTestSQSClient(mock as unknown as SQSClient)
  return mock
}
```

3. **Use in tests** with type-safe assertions:

```typescript
import {createSQSClientMock} from '#test/helpers/aws-sdk-mock'
import {SendMessageCommand} from '@aws-sdk/client-sqs'

const sqsMock = createSQSClientMock()

beforeEach(() => {
  sqsMock.reset()
  sqsMock.on(SendMessageCommand).resolves({MessageId: 'msg-123'})
})

test('should send message', async () => {
  await handler(event, context)

  expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
    QueueUrl: expect.stringContaining('SendPushNotification')
  })
})
```

---

## Recommendations

### Short-term

1. Install `aws-sdk-client-mock` and `aws-sdk-client-mock-vitest`
2. Create helper functions in `test/helpers/aws-sdk-mock.ts`
3. Add test injection capability to client factory

### Medium-term

1. Migrate Lambda tests with heavy AWS usage (RegisterDevice, StartFileUpload, etc.)
2. Keep existing patterns for tests without AWS calls
3. Update documentation with new patterns

### Long-term

1. Consider standardizing on aws-sdk-client-mock for all AWS mocking
2. Evaluate if vendor wrapper tests can be simplified
3. Monitor for new Vitest-native AWS mocking solutions

---

## References

- [aws-sdk-client-mock GitHub](https://github.com/m-radzikowski/aws-sdk-client-mock)
- [aws-sdk-client-mock-vitest NPM](https://www.npmjs.com/package/aws-sdk-client-mock-vitest)
- [AWS SDK v3 Mocking Blog](https://aws.amazon.com/blogs/developer/mocking-modular-aws-sdk-for-javascript-v3-in-unit-tests/)
- [Vitest Mocking Strategy](./Vitest-Mocking-Strategy.md)
