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

### Entity Mock Helper (CRITICAL)

**Zero-tolerance rule**: ALWAYS use `createEntityMock()` from `test/helpers/entity-mock.ts` for mocking entities.

```typescript
import {createEntityMock} from '../../../test/helpers/entity-mock'
import type {File} from '../../../types/domain-models'

// Create mock before mocking module
const filesMock = createEntityMock<File>()

// Mock the entity module
vi.mock('../../../entities/Files', () => ({
  Files: filesMock.entity
}))

// Later in tests - use the mocks for assertions
filesMock.mocks.get.mockResolvedValue({
  data: {fileId: '123', status: 'Downloaded'}
})

expect(filesMock.mocks.create).toHaveBeenCalledWith({
  fileId: '123',
  // ... other properties
})
```

**Benefits**:
- Type-safe mocks with full TypeScript inference
- Consistent mock structure across all tests
- Simplified setup with pre-configured query patterns
- Supports all entity operations (get, create, update, query, etc.)

## Testing Checklist

- [ ] List all imports in test file
- [ ] Read source files, list their imports
- [ ] Mock ALL external dependencies
- [ ] Mock BEFORE importing handler
- [ ] Add TypeScript types to mocks
- [ ] Test locally AND in CI

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| Cannot find module | Missing mock | Add vi.mock |
| X is not a constructor | Wrong mock structure | Mock as class with constructor |
| Property X doesn't exist | Incomplete mock | Add missing properties |
| Works locally, fails CI | Environment differences | Mock all transitive deps |

## Best Practices

1. **Mock first, import second** - Always mock before importing
2. **Mock everything external** - All npm packages and AWS SDK
3. **Use type assertions** - Add proper types to mocks
4. **Use mock helpers** - Entity mock helper for entities, AWS SDK mock helpers for AWS services
5. **Map dependencies** - Trace all transitive imports
6. **Prefer aws-sdk-client-mock** - For AWS SDK v3 clients, use `aws-sdk-client-mock` for type-safe assertions

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

## Related Patterns

- [Mock Type Annotations](Mock-Type-Annotations.md) - TypeScript mock patterns
- [Lazy Initialization](Lazy-Initialization-Pattern.md) - Defer module execution
- [Coverage Philosophy](Coverage-Philosophy.md) - Test strategy

---

*Mock ALL transitive dependencies in ES modules to prevent obscure test failures.*
