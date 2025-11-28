# ElectroDB Collections Integration Test Template

Create comprehensive integration tests for ElectroDB Collections using LocalStack.

## Setup Instructions

1. Create test directory:
```bash
mkdir -p test/integration/electrodb
```

2. Create test file: `test/integration/electrodb/Collections.integration.test.ts`

## Complete Test Template

```typescript
import {describe, test, expect, beforeAll, afterAll} from '@jest/globals'
import {setupLocalStackTable, cleanupLocalStackTable} from '../helpers/electrodb-localstack'
import {collections} from '../../../src/entities/Collections'
import {Users} from '../../../src/entities/Users'
import {Files} from '../../../src/entities/Files'
import {Devices} from '../../../src/entities/Devices'
import {UserFiles} from '../../../src/entities/UserFiles'
import {UserDevices} from '../../../src/entities/UserDevices'
import {Sessions} from '../../../src/entities/Sessions'
import {Accounts} from '../../../src/entities/Accounts'
import {FileStatus} from '../../../src/types/enums'

describe('ElectroDB Collections Integration', () => {
  beforeAll(async () => {
    await setupLocalStackTable()
  }, 30000)

  afterAll(async () => {
    await cleanupLocalStackTable()
  })

  describe('userResources collection', () => {
    test('should query all files and devices for a user', async () => {
      // Setup: Create user with files and devices
      const userId = 'user-1'
      await Users.create({userId, appleDeviceIdentifier: 'apple-1'}).go()
      await Files.create({
        fileId: 'file-1',
        status: FileStatus.Downloaded,
        url: 'https://example.com/video.mp4',
        availableAt: Date.now(),
        size: 1024000,
        authorName: 'Test',
        authorUser: 'test',
        publishDate: new Date().toISOString(),
        description: 'Test video',
        key: 'file-1',
        contentType: 'video/mp4',
        title: 'Test Video'
      }).go()
      await Devices.create({deviceId: 'device-1', deviceToken: 'token-1', userId}).go()
      await UserFiles.create({userId, fileId: 'file-1'}).go()
      await UserDevices.create({userId, deviceId: 'device-1'}).go()

      // Execute: Query collection
      const result = await collections.userResources({userId}).go()

      // Verify: All related entities returned
      expect(result.data.Users).toHaveLength(1)
      expect(result.data.Files).toHaveLength(1)
      expect(result.data.Devices).toHaveLength(1)
      expect(result.data.UserFiles).toHaveLength(1)
      expect(result.data.UserDevices).toHaveLength(1)
    }, 30000)

    test('should return empty arrays when user has no resources', async () => {
      const userId = 'user-empty'
      await Users.create({userId, appleDeviceIdentifier: 'apple-2'}).go()

      const result = await collections.userResources({userId}).go()

      expect(result.data.Users).toHaveLength(1)
      expect(result.data.Files).toHaveLength(0)
      expect(result.data.UserFiles).toHaveLength(0)
      expect(result.data.UserDevices).toHaveLength(0)
    }, 30000)
  })

  describe('fileUsers collection', () => {
    test('should query all users associated with a file', async () => {
      // Setup: Multiple users sharing same file
      const fileId = 'shared-file'
      await Users.create({userId: 'user-1', appleDeviceIdentifier: 'apple-1'}).go()
      await Users.create({userId: 'user-2', appleDeviceIdentifier: 'apple-2'}).go()
      await Files.create({
        fileId,
        status: FileStatus.Downloaded,
        url: 'https://example.com/shared.mp4',
        availableAt: Date.now(),
        size: 2048000,
        authorName: 'Shared',
        authorUser: 'shared',
        publishDate: new Date().toISOString(),
        description: 'Shared video',
        key: fileId,
        contentType: 'video/mp4',
        title: 'Shared Video'
      }).go()
      await UserFiles.create({userId: 'user-1', fileId}).go()
      await UserFiles.create({userId: 'user-2', fileId}).go()

      // Execute: Query all users for file
      const result = await collections.fileUsers({fileId}).go()

      // Verify: Both users returned (for push notifications)
      expect(result.data.Files).toHaveLength(1)
      expect(result.data.UserFiles).toHaveLength(2)
      expect(result.data.Users).toHaveLength(2)
    }, 30000)
  })

  describe('deviceUsers collection', () => {
    test('should query all users for a device', async () => {
      const deviceId = 'shared-device'
      await Users.create({userId: 'user-1', appleDeviceIdentifier: 'apple-1'}).go()
      await Devices.create({deviceId, deviceToken: 'token-shared', userId: 'user-1'}).go()
      await UserDevices.create({userId: 'user-1', deviceId}).go()

      const result = await collections.deviceUsers({deviceId}).go()

      expect(result.data.Devices).toHaveLength(1)
      expect(result.data.Users).toHaveLength(1)
      expect(result.data.UserDevices).toHaveLength(1)
    }, 30000)
  })

  describe('userSessions collection (Better Auth)', () => {
    test('should query all active sessions for a user', async () => {
      const userId = 'user-auth'
      await Users.create({userId, appleDeviceIdentifier: 'apple-auth'}).go()
      await Sessions.create({
        sessionId: 'session-1',
        userId,
        token: 'token-1',
        expiresAt: Date.now() + 86400000
      }).go()
      await Sessions.create({
        sessionId: 'session-2',
        userId,
        token: 'token-2',
        expiresAt: Date.now() + 86400000
      }).go()

      const result = await collections.userSessions({userId}).go()

      expect(result.data.Sessions).toHaveLength(2)
    }, 30000)
  })

  describe('userAccounts collection (Better Auth)', () => {
    test('should query OAuth accounts for a user', async () => {
      const userId = 'user-oauth'
      await Users.create({userId, appleDeviceIdentifier: 'apple-oauth'}).go()
      await Accounts.create({
        accountId: 'account-1',
        userId,
        provider: 'apple',
        providerAccountId: 'apple-id-123'
      }).go()

      const result = await collections.userAccounts({userId}).go()

      expect(result.data.Accounts).toHaveLength(1)
      expect(result.data.Accounts[0].provider).toBe('apple')
    }, 30000)
  })

  describe('batch operations', () => {
    test('should batch get multiple files', async () => {
      await Files.create({
        fileId: 'batch-1',
        status: FileStatus.Downloaded,
        url: 'https://example.com/batch1.mp4',
        availableAt: Date.now(),
        size: 1000,
        authorName: 'Test',
        authorUser: 'test',
        publishDate: new Date().toISOString(),
        description: 'Batch 1',
        key: 'batch-1',
        contentType: 'video/mp4',
        title: 'Batch 1'
      }).go()
      await Files.create({
        fileId: 'batch-2',
        status: FileStatus.PendingDownload,
        url: 'https://example.com/batch2.mp4',
        availableAt: Date.now(),
        size: 2000,
        authorName: 'Test',
        authorUser: 'test',
        publishDate: new Date().toISOString(),
        description: 'Batch 2',
        key: 'batch-2',
        contentType: 'video/mp4',
        title: 'Batch 2'
      }).go()

      const keys = [{fileId: 'batch-1'}, {fileId: 'batch-2'}]
      const {data, unprocessed} = await Files.get(keys).go({concurrency: 5})

      expect(data).toHaveLength(2)
      expect(unprocessed).toHaveLength(0)
    }, 30000)

    test('should batch delete multiple records', async () => {
      const userId = 'user-batch-delete'
      await UserFiles.create({userId, fileId: 'file-1'}).go()
      await UserFiles.create({userId, fileId: 'file-2'}).go()

      const keys = [{userId, fileId: 'file-1'}, {userId, fileId: 'file-2'}]
      await UserFiles.delete(keys).go()

      const result = await UserFiles.query.byUser({userId}).go()
      expect(result.data).toHaveLength(0)
    }, 30000)
  })

  describe('edge cases', () => {
    test('should handle non-existent user query', async () => {
      const result = await collections.userResources({userId: 'non-existent'}).go()
      expect(result.data.Users).toHaveLength(0)
    }, 30000)

    test('should prevent duplicate records with conditional create', async () => {
      await UserFiles.create({userId: 'dup-user', fileId: 'dup-file'}).go()

      await expect(
        UserFiles.create({userId: 'dup-user', fileId: 'dup-file'}).go()
      ).rejects.toThrow('The conditional request failed')
    }, 30000)

    test('should handle empty batch operations', async () => {
      const {data} = await Files.get([]).go()
      expect(data).toHaveLength(0)
    }, 30000)
  })
})
```

## Run Tests

```bash
# Start LocalStack
pnpm run localstack:start

# Run integration tests
pnpm run test:integration

# Stop LocalStack
pnpm run localstack:stop
```

## What This Tests

✅ **Collections** - JOIN-like queries (userResources, fileUsers, deviceUsers, userSessions, userAccounts)
✅ **Batch operations** - Batch get/delete with concurrency
✅ **Single-table design** - GSI queries across entity boundaries
✅ **Better Auth** - Session and account entity integration
✅ **Edge cases** - Empty results, duplicates, non-existent records

## Related Documentation

- [ElectroDB Testing Patterns](docs/wiki/Testing/ElectroDB-Testing-Patterns.md)
- [LocalStack Testing](docs/wiki/Integration/LocalStack-Testing.md)
- [Jest ESM Mocking Strategy](docs/wiki/Testing/Jest-ESM-Mocking-Strategy.md)

---

*Comprehensive integration testing for ElectroDB single-table design with LocalStack.*
