# Mock Factory Patterns

This document describes the mock factory patterns used in test helpers.

## AWS SDK Mock Pattern (`test/helpers/aws-sdk-mock.ts`)

### Factory Functions
- `createS3Mock()` - S3 client mock with test injection
- `createSQSMock()` - SQS client mock
- `createSNSMock()` - SNS client mock
- `createEventBridgeMock()` - EventBridge client mock
- `createDynamoDBMock()` - DynamoDB client mock
- `createLambdaMock()` - Lambda client mock

### Usage Pattern
```typescript
import {createSNSMock, resetAllAwsMocks} from '#test/helpers/aws-sdk-mock'

const snsMock = createSNSMock()

beforeEach(() => {
  snsMock.on(PublishCommand).resolves(createSNSPublishResponse())
})

afterAll(() => {
  resetAllAwsMocks()
})
```

### Integration with Vendor Wrappers
Mocks integrate via `setTestXXXClient()` functions for dependency injection.

## Drizzle Mock Pattern (`test/helpers/drizzle-mock.ts`)

### Factory Functions
- `createDrizzleDeleteMock()` - Chainable delete().where().returning()
- `createDrizzleSelectMock()` - Chainable select().from().where()
- `createDrizzleExecuteMock()` - Raw SQL execution
- `createDrizzleOperatorMocks()` - All drizzle-orm operators
- `createDrizzleClientMock()` - Combined client mock

## Entity Fixture Pattern (`test/helpers/entity-fixtures.ts`)

### Factory Functions
- `createMockUser()` - User entity with Sign In With Apple fields
- `createMockFile()` - File entity with video defaults
- `createMockDevice()` - Device entity with APNS token
- `createMockSession()` - Session with 24 h expiry
- Relationship factories: `createMockUserFile()`, `createMockUserDevice()`

### Usage
```typescript
import {createMockUser, createMockFile} from '#test/helpers/entity-fixtures'

const user = createMockUser({email: 'test@example.com'})
const file = createMockFile({fileId: 'video-123', status: 'Downloaded'})
```

## Entity Query Mocking

### Current Pattern (Vitest)
```typescript
import {vi} from 'vitest'

vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  getUserFiles: vi.fn()
}))
```

### Setting Up Return Values
```typescript
import {getUser, createUser} from '#entities/queries'

beforeEach(() => {
  vi.mocked(getUser).mockResolvedValue(createMockUser())
  vi.mocked(createUser).mockResolvedValue(createMockUser())
})
```

## Best Practices

1. **Use factory functions** - Don't hardcode mock data inline
2. **Reset mocks in beforeEach** - Prevent test pollution
3. **Type mock return values** - Use `vi.mocked()` for type safety
4. **Mock at boundaries** - Mock vendor wrappers, not internal functions
