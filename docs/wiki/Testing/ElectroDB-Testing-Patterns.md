# ElectroDB Testing Patterns

This guide documents testing patterns for ElectroDB entities and collections, combining unit tests (mocked) with integration tests (LocalStack).

## Overview

ElectroDB is a DynamoDB ORM providing type-safe, single-table design with Collections for JOIN-like queries.

**Testing Strategy**:
- **Unit Tests**: Mock ElectroDB entities for fast, isolated Lambda handler tests
- **Integration Tests**: Real ElectroDB operations against LocalStack for multi-entity workflows

## Unit Testing with Mocks

### Using the ElectroDB Mock Helper

**Always use `test/helpers/electrodb-mock.ts`** - never create manual mocks.

```typescript
import {createElectroDBEntityMock} from '../../../test/helpers/electrodb-mock'
import {DynamoDBFile} from '../../../src/types/main'

// Create mock with query support
const filesMock = createElectroDBEntityMock<DynamoDBFile>({
  queryIndexes: ['byKey', 'byStatus']
})

// Use in jest.unstable_mockModule
jest.unstable_mockModule('../../../src/entities/Files', () => ({
  Files: filesMock.entity
}))

// Setup mock behavior
filesMock.mocks.get.mockResolvedValue({
  data: {fileId: 'test-123', status: 'Downloaded'}
})

// THEN import handler
const {handler} = await import('../src/index')

// Run test
await handler(event, context)

// Assert
expect(filesMock.mocks.get).toHaveBeenCalledWith({fileId: 'test-123'})
```

### Common Mock Patterns

#### Get Operation
```typescript
// Single get
filesMock.mocks.get.mockResolvedValue({
  data: {fileId: '123', status: 'Downloaded'}
})

// Batch get
filesMock.mocks.get.mockResolvedValue({
  data: [
    {fileId: '123', status: 'Downloaded'},
    {fileId: '456', status: 'Pending'}
  ],
  unprocessed: []
})

// Not found
filesMock.mocks.get.mockResolvedValue({data: undefined})
```

#### Query Operation
```typescript
// Query by index
filesMock.mocks.query.byStatus!.go.mockResolvedValue({
  data: [{fileId: '123', status: 'Downloaded'}]
})

// Empty result
filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: []})
```

#### Create Operation
```typescript
filesMock.mocks.create.mockResolvedValue({
  data: {fileId: '123', status: 'Pending'}
})

// Idempotent create (already exists)
filesMock.mocks.create.mockRejectedValue(
  new Error('The conditional request failed')
)
```

#### Update Operation
```typescript
filesMock.mocks.update.go.mockResolvedValue({
  data: {fileId: '123', status: 'Downloaded'}
})

// Update with set
filesMock.mocks.update.set.mockReturnValue({
  go: filesMock.mocks.update.go
})
```

#### Delete Operation
```typescript
// Single delete
filesMock.mocks.delete.mockResolvedValue(undefined)

// Batch delete
filesMock.mocks.delete.mockResolvedValue({
  unprocessed: []
})
```

### Testing Collections

Collections combine multiple entities for JOIN-like queries:

```typescript
import {createElectroDBEntityMock} from '../../../test/helpers/electrodb-mock'

// Mock Collections service
const collectionsMock = {
  userResources: jest.fn(() => ({
    go: jest.fn<() => Promise<{
      data: {
        Users: any[]
        Files: any[]
        UserFiles: any[]
        UserDevices: any[]
      }
    }>>().mockResolvedValue({
      data: {
        Users: [{userId: 'user-1'}],
        Files: [{fileId: 'file-1'}, {fileId: 'file-2'}],
        UserFiles: [{userId: 'user-1', fileId: 'file-1'}],
        UserDevices: []
      }
    })
  })),
  fileUsers: jest.fn(() => ({
    go: jest.fn<() => Promise<{
      data: {
        Files: any[]
        Users: any[]
        UserFiles: any[]
      }
    }>>().mockResolvedValue({
      data: {
        Files: [{fileId: 'file-1'}],
        Users: [{userId: 'user-1'}, {userId: 'user-2'}],
        UserFiles: [{userId: 'user-1', fileId: 'file-1'}]
      }
    })
  }))
}

jest.unstable_mockModule('../../../src/entities/Collections', () => ({
  collections: collectionsMock
}))
```

## Integration Testing with LocalStack

### Setup

Integration tests use real ElectroDB operations against LocalStack DynamoDB.

#### Test File Structure
```typescript
import {describe, test, expect, beforeAll, afterAll, beforeEach} from '@jest/globals'
import {setupLocalStackTable, cleanupLocalStackTable} from '../helpers/electrodb-localstack'
import {collections} from '../../../src/entities/Collections'
import {Users} from '../../../src/entities/Users'
import {Files} from '../../../src/entities/Files'

describe('ElectroDB Integration', () => {
  beforeAll(async () => {
    await setupLocalStackTable()  // Create table with GSIs
  }, 30000)

  afterAll(async () => {
    await cleanupLocalStackTable()  // Delete table
  })

  beforeEach(async () => {
    // Clear all data between tests
    // See test/integration/electrodb/Collections.integration.test.ts
  }, 30000)

  test('should perform real ElectroDB operations', async () => {
    // Test implementation
  }, 30000)
})
```

### Table Setup Helper

`test/integration/helpers/electrodb-localstack.ts` provides:

```typescript
// Create MediaDownloader table with all GSIs
await setupLocalStackTable()

// Delete table (cleanup)
await cleanupLocalStackTable()
```

**Table Design**:
- Primary Key: `PK`, `SK`
- GSI1: `GSI1PK`, `GSI1SK` (UserCollection - userResources)
- GSI2: `GSI2PK`, `GSI2SK` (FileCollection - fileUsers)
- GSI3: `GSI3PK`, `GSI3SK` (DeviceCollection - deviceUsers)

### Common Integration Test Patterns

#### Testing Collections (JOIN-like queries)

```typescript
test('should query user resources (JOIN)', async () => {
  // Arrange: Create related entities
  await Users.create({
    userId: 'user-1',
    appleDeviceIdentifier: 'apple-123'
  }).go()

  await Files.create({
    fileId: 'file-1',
    status: FileStatus.Downloaded,
    // ... required fields
  }).go()

  await UserFiles.create({
    userId: 'user-1',
    fileId: 'file-1'
  }).go()

  // Act: Query using Collection
  const result = await collections.userResources({userId: 'user-1'}).go()

  // Assert: Verify JOIN worked
  expect(result.data.Users).toHaveLength(1)
  expect(result.data.Files).toHaveLength(1)
  expect(result.data.UserFiles).toHaveLength(1)
}, 30000)
```

#### Testing Batch Operations

```typescript
test('should batch get multiple files', async () => {
  const fileIds = ['file-1', 'file-2', 'file-3']

  // Arrange: Create files
  for (const fileId of fileIds) {
    await Files.create({fileId, /* ... */}).go()
  }

  // Act: Batch get
  const result = await Files.get(
    fileIds.map(fileId => ({fileId}))
  ).go()

  // Assert
  expect(result.data).toHaveLength(3)
}, 30000)
```

#### Testing Query Patterns

```typescript
test('should query files by status', async () => {
  // Arrange
  await Files.create({
    fileId: 'downloaded-1',
    status: FileStatus.Downloaded,
    // ...
  }).go()

  await Files.create({
    fileId: 'pending-1',
    status: FileStatus.PendingDownload,
    // ...
  }).go()

  // Act: Query by GSI
  const result = await Files.query.byStatus({
    status: FileStatus.Downloaded
  }).go()

  // Assert
  expect(result.data).toHaveLength(1)
  expect(result.data[0].fileId).toBe('downloaded-1')
}, 30000)
```

#### Testing Entity Relationships

```typescript
test('should link users to files', async () => {
  const userId = 'user-1'
  const fileId = 'file-1'

  // Arrange: Create entities
  await Users.create({userId, appleDeviceIdentifier: 'apple-123'}).go()
  await Files.create({fileId, status: FileStatus.Downloaded, /* ... */}).go()

  // Act: Create relationship
  await UserFiles.create({userId, fileId}).go()

  // Assert: Query relationship works
  const result = await collections.userResources({userId}).go()
  expect(result.data.Files).toHaveLength(1)
  expect(result.data.Files[0].fileId).toBe(fileId)
}, 30000)
```

## Best Practices

### Unit Tests

1. **Mock ALL ElectroDB entities** used by handler (direct + transitive)
2. **Use `createElectroDBEntityMock`** - never manual mocks
3. **Specify query indexes** when creating mocks:
   ```typescript
   createElectroDBEntityMock<DynamoDBFile>({
     queryIndexes: ['byKey', 'byStatus']
   })
   ```
4. **Type mock return values** for type safety:
   ```typescript
   jest.fn<() => Promise<{data: DynamoDBFile}>>()
   ```

### Integration Tests

1. **Test YOUR workflows**, not ElectroDB/DynamoDB behavior
2. **Use Collections for JOIN patterns** - validates single-table design
3. **Clean data between tests** - ensure test isolation
4. **Set 30-second timeout** - LocalStack can be slow
5. **Test entity relationships** - verify GSI configurations work

### When to Use Each

**Unit Tests (Mocked)**:
- Lambda handler logic
- Input validation
- Error handling
- Business logic
- Fast feedback (milliseconds)

**Integration Tests (LocalStack)**:
- Multi-entity workflows
- Collection queries (JOINs)
- Batch operations
- GSI query patterns
- Entity relationships
- State transitions
- Slower but comprehensive (seconds)

## Common Pitfalls

### ❌ Don't: Manual ElectroDB Mocks
```typescript
// Wrong - manual mock
const filesMock = {
  get: jest.fn(),
  create: jest.fn()
}
```

### ✅ Do: Use Mock Helper
```typescript
// Correct - use helper
const filesMock = createElectroDBEntityMock<DynamoDBFile>()
```

### ❌ Don't: Test DynamoDB Behavior
```typescript
// Wrong - tests DynamoDB, not YOUR code
test('should store item in DynamoDB', async () => {
  await Files.create({fileId: '123'}).go()
  const result = await Files.get({fileId: '123'}).go()
  expect(result.data).toBeDefined()
})
```

### ✅ Do: Test YOUR Workflows
```typescript
// Correct - tests YOUR orchestration
test('should download file and update status', async () => {
  // Arrange: Create pending file
  await Files.create({fileId: '123', status: 'Pending'}).go()

  // Act: YOUR Lambda handler
  await handler({fileId: '123'}, context)

  // Assert: YOUR status transition
  const file = await Files.get({fileId: '123'}).go()
  expect(file.data.status).toBe('Downloaded')
})
```

### ❌ Don't: Forget to Clean Data
```typescript
// Wrong - tests interfere with each other
describe('Tests', () => {
  test('creates user', async () => {
    await Users.create({userId: '1'}).go()
  })

  test('creates user', async () => {
    await Users.create({userId: '1'}).go()  // Fails - already exists
  })
})
```

### ✅ Do: Clean Between Tests
```typescript
// Correct - isolated tests
describe('Tests', () => {
  beforeEach(async () => {
    // Clear all data
  })

  test('creates user', async () => {
    await Users.create({userId: '1'}).go()
  })

  test('creates user', async () => {
    await Users.create({userId: '1'}).go()  // Works - fresh state
  })
})
```

## Example Test Files

### Unit Test Example
See: `src/lambdas/ListFiles/test/index.test.ts`

### Integration Test Example
See: `test/integration/electrodb/Collections.integration.test.ts`

## References

- [Coverage Philosophy](./Coverage-Philosophy.md)
- [Jest ESM Mocking Strategy](./Jest-ESM-Mocking-Strategy.md)
- [LocalStack Testing](../Integration/LocalStack-Testing.md)
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md)

## See Also

- `test/helpers/electrodb-mock.ts` - Mock helper implementation
- `test/integration/helpers/electrodb-localstack.ts` - LocalStack setup
- `src/entities/Collections.ts` - ElectroDB Collections service
- `src/entities/` - All ElectroDB entity definitions
