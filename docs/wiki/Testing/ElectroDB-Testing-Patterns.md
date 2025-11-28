# ElectroDB Testing Patterns

## Quick Reference
- **When to use**: Testing DynamoDB operations with ElectroDB
- **Enforcement**: Required for all DynamoDB code
- **Impact if violated**: HIGH - Untested database operations

## Overview

Comprehensive testing strategy for ElectroDB entities covering unit tests (mocked) and integration tests (LocalStack). Validates single-table design, Collections (JOIN operations), and type-safe queries.

## Unit Testing (Mocked)

### Using electrodb-mock Helper

```typescript
import {createElectroDBEntityMock} from '../../../test/helpers/electrodb-mock'
import {Files} from '../entities/Files'

// Mock the entity
const filesMock = createElectroDBEntityMock<FileData>({
  queryIndexes: ['byStatus', 'byUser']
})
jest.unstable_mockModule('../entities/Files', () => ({Files: filesMock.entity}))

// Setup test data
filesMock.mocks.query.byStatus!.go.mockResolvedValue({
  data: [{fileId: 'file-1', status: 'Downloaded'}]
})

// Test
const result = await Files.query.byStatus({status: 'Downloaded'}).go()
expect(result.data).toHaveLength(1)
expect(filesMock.mocks.query.byStatus!.go).toHaveBeenCalledTimes(1)
```

### Mock Operations Supported

**Query operations**:
```typescript
Files.query.byUser({userId}).go()
Files.query.byStatus({status}).go()
Files.query.byKey({fileId}).go()
```

**Get operations** (single and batch):
```typescript
Files.get({fileId}).go()              // Single
Files.get([{fileId: 'a'}, {fileId: 'b'}]).go()  // Batch
```

**Create/Update/Delete**:
```typescript
Files.create({fileId, ...}).go()
Files.update({fileId}).set({status: 'Downloaded'}).go()
Files.delete({fileId}).go()
```

### Available Query Indexes

Entity-specific indexes available via `queryIndexes` parameter:

**Files**: `['byStatus', 'byUser', 'byKey']`
**Users**: `['byUser', 'byDevice']`
**UserFiles**: `['byUser', 'byFile']`
**UserDevices**: `['byUser', 'byDevice']`
**Sessions**: `['byUser']`  *(Better Auth)*
**Accounts**: `['byUser']`  *(Better Auth)*

## Integration Testing (LocalStack)

### LocalStack Setup

```typescript
import {setupLocalStackTable, cleanupLocalStackTable} from '../helpers/electrodb-localstack'

beforeAll(async () => {
  await setupLocalStackTable()
})

afterAll(async () => {
  await cleanupLocalStackTable()
})
```

**What it creates**:
- MediaDownloader table (single-table design)
- Primary index: PK, SK
- GSI1: userResources (Users + Files + Devices for user)
- GSI2: fileUsers (Users who have access to file)
- GSI3: deviceUsers (Devices associated with user)

### Collections Testing (JOIN Operations)

**Collections** enable JOIN-like queries across entities in single-table design.

#### userResources Collection

Get all resources for a user (Files + Devices):

```typescript
import {collections} from '../../../src/entities/Collections'

test('userResources - get all user resources', async () => {
  // Setup: Create user, files, devices
  await Users.create({userId: 'user-1', appleDeviceIdentifier: 'apple-1'}).go()
  await Files.create({fileId: 'file-1', status: 'Downloaded', url: 'https://...'}).go()
  await UserFiles.create({userId: 'user-1', fileId: 'file-1'}).go()
  await Devices.create({deviceId: 'dev-1', deviceName: 'iPhone'}).go()
  await UserDevices.create({userId: 'user-1', deviceId: 'dev-1'}).go()

  // Query: Get all resources for user
  const result = await collections.userResources({userId: 'user-1'}).go()

  // Validate
  expect(result.data.Users).toHaveLength(1)
  expect(result.data.Files).toHaveLength(1)
  expect(result.data.Devices).toHaveLength(1)
  expect(result.data.UserFiles).toHaveLength(1)
  expect(result.data.UserDevices).toHaveLength(1)
})
```

#### fileUsers Collection

Get all users who have access to a file (for notifications):

```typescript
test('fileUsers - notification use case', async () => {
  // Setup: Multiple users sharing file
  await Users.create({userId: 'user-1', appleDeviceIdentifier: 'apple-1'}).go()
  await Users.create({userId: 'user-2', appleDeviceIdentifier: 'apple-2'}).go()
  await Files.create({fileId: 'shared-file', status: 'Downloaded'}).go()
  await UserFiles.create({userId: 'user-1', fileId: 'shared-file'}).go()
  await UserFiles.create({userId: 'user-2', fileId: 'shared-file'}).go()

  // Query: Get all users to notify
  const result = await collections.fileUsers({fileId: 'shared-file'}).go()

  // Validate: Both users returned
  expect(result.data.Users).toHaveLength(2)
  expect(result.data.UserFiles).toHaveLength(2)
})
```

#### userSessions Collection (Better Auth)

Get all active sessions for a user:

```typescript
test('userSessions - authentication sessions', async () => {
  // Setup: User with multiple sessions
  await Users.create({userId: 'user-1', appleDeviceIdentifier: 'apple-1'}).go()
  await Sessions.create({
    sessionId: 'session-1',
    userId: 'user-1',
    token: 'token-1',
    expiresAt: Date.now() + 86400000
  }).go()
  await Sessions.create({
    sessionId: 'session-2',
    userId: 'user-1',
    token: 'token-2',
    expiresAt: Date.now() + 86400000
  }).go()

  // Query: Get all sessions
  const result = await collections.userSessions({userId: 'user-1'}).go()

  // Validate
  expect(result.data.Sessions).toHaveLength(2)
})
```

#### userAccounts Collection (Better Auth)

Get OAuth accounts linked to user:

```typescript
test('userAccounts - OAuth account linking', async () => {
  // Setup: User with Apple OAuth account
  await Users.create({userId: 'user-1', appleDeviceIdentifier: 'apple-1'}).go()
  await Accounts.create({
    accountId: 'account-1',
    userId: 'user-1',
    provider: 'apple',
    providerAccountId: 'apple-user-id'
  }).go()

  // Query: Get linked accounts
  const result = await collections.userAccounts({userId: 'user-1'}).go()

  // Validate
  expect(result.data.Accounts).toHaveLength(1)
  expect(result.data.Accounts[0].provider).toBe('apple')
})
```

### Batch Operations

#### Batch Get

```typescript
test('batch get - multiple files', async () => {
  await Files.create({fileId: 'file-1', status: 'Downloaded'}).go()
  await Files.create({fileId: 'file-2', status: 'Pending'}).go()
  await Files.create({fileId: 'file-3', status: 'Downloaded'}).go()

  const keys = [{fileId: 'file-1'}, {fileId: 'file-2'}, {fileId: 'file-3'}]
  const {data, unprocessed} = await Files.get(keys).go({concurrency: 5})

  expect(data).toHaveLength(3)
  expect(unprocessed).toHaveLength(0)
})
```

#### Batch Delete

```typescript
test('batch delete - cleanup orphaned records', async () => {
  await UserFiles.create({userId: 'user-1', fileId: 'file-1'}).go()
  await UserFiles.create({userId: 'user-1', fileId: 'file-2'}).go()

  const keys = [{userId: 'user-1', fileId: 'file-1'}, {userId: 'user-1', fileId: 'file-2'}]
  await UserFiles.delete(keys).go()

  // Verify deletion
  const result = await UserFiles.query.byUser({userId: 'user-1'}).go()
  expect(result.data).toHaveLength(0)
})
```

### Query Patterns

#### Pagination

```typescript
test('pagination - large result sets', async () => {
  // Create 100 files
  for (let i = 0; i < 100; i++) {
    await Files.create({fileId: `file-${i}`, status: 'Downloaded'}).go()
  }

  // First page
  const page1 = await Files.query.byStatus({status: 'Downloaded'}).go({pages: 1, limit: 25})
  expect(page1.data).toHaveLength(25)
  expect(page1.cursor).toBeDefined()

  // Second page
  const page2 = await Files.query.byStatus({status: 'Downloaded'})
    .go({cursor: page1.cursor, limit: 25})
  expect(page2.data).toHaveLength(25)
})
```

#### Filtering

```typescript
test('filter - conditional queries', async () => {
  await Files.create({fileId: 'file-1', status: 'Downloaded', size: 1000}).go()
  await Files.create({fileId: 'file-2', status: 'Downloaded', size: 5000}).go()
  await Files.create({fileId: 'file-3', status: 'Downloaded', size: 10000}).go()

  // Filter files > 2MB
  const result = await Files.query.byStatus({status: 'Downloaded'})
    .where(({size}, {gt}) => gt(size, 2000))
    .go()

  expect(result.data).toHaveLength(2)
  expect(result.data.every(f => f.size > 2000)).toBe(true)
})
```

### Edge Cases

#### Empty Results

```typescript
test('empty results - no data found', async () => {
  const result = await Files.query.byUser({userId: 'non-existent'}).go()
  expect(result.data).toHaveLength(0)
})
```

#### Conditional Create (Idempotency)

```typescript
test('conditional create - prevent duplicates', async () => {
  await UserFiles.create({userId: 'user-1', fileId: 'file-1'}).go()

  // Second create should fail
  await expect(
    UserFiles.create({userId: 'user-1', fileId: 'file-1'}).go()
  ).rejects.toThrow('The conditional request failed')
})
```

#### Update Non-Existent

```typescript
test('update non-existent - throws error', async () => {
  await expect(
    Files.update({fileId: 'non-existent'}).set({status: 'Downloaded'}).go()
  ).rejects.toThrow()
})
```

## Entity Reference

### Files
- **Primary**: `{fileId}`
- **Indexes**: byStatus, byUser (via UserFiles), byKey
- **Attributes**: status, size, url, title, publishDate, etc.

### Users
- **Primary**: `{userId}`
- **Indexes**: byUser, byDevice (via UserDevices)
- **Attributes**: appleDeviceIdentifier, email, name, etc.

### Devices
- **Primary**: `{deviceId}`
- **Indexes**: byDevice, byUser (via UserDevices)
- **Attributes**: deviceName, pushToken, platform, etc.

### UserFiles (Junction)
- **Primary**: `{userId, fileId}`
- **Indexes**: byUser, byFile
- **Purpose**: Many-to-many relationship

### UserDevices (Junction)
- **Primary**: `{userId, deviceId}`
- **Indexes**: byUser, byDevice
- **Purpose**: Many-to-many relationship

### Sessions (Better Auth)
- **Primary**: `{sessionId}`
- **Indexes**: byUser
- **Attributes**: userId, token, expiresAt, createdAt

### Accounts (Better Auth)
- **Primary**: `{accountId}`
- **Indexes**: byUser
- **Attributes**: userId, provider, providerAccountId, accessToken, refreshToken

### VerificationTokens (Better Auth)
- **Primary**: `{identifier, token}`
- **Attributes**: expiresAt, createdAt

## Best Practices

✅ Use `createElectroDBEntityMock` for unit tests (fast, isolated)
✅ Use LocalStack for integration tests (real DynamoDB operations)
✅ Test Collections to validate single-table design
✅ Test batch operations with realistic data volumes
✅ Cover edge cases (empty results, duplicates, non-existent records)
✅ Use pagination for large result sets
✅ Verify GSI queries return correct data
✅ Test conditional operations (idempotency)

❌ Don't test ElectroDB library itself (trust the library)
❌ Don't create integration tests for every query (unit tests for most)
❌ Don't mock DynamoDB clients directly (use electrodb-mock)

## Related Patterns

- [Fixture Extraction](Fixture-Extraction.md)
- [LocalStack Testing](../Integration/LocalStack-Testing.md)
- [Jest ESM Mocking Strategy](Jest-ESM-Mocking-Strategy.md)

---

*Validate single-table design with Collections. Trust ElectroDB for type safety.*
