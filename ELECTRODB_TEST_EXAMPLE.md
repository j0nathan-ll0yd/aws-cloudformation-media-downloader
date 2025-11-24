# ElectroDB Collections Integration Test

This file should be created at: `test/integration/electrodb/Collections.integration.test.ts`

## Setup Instructions

1. Create the directory:
```bash
mkdir -p test/integration/electrodb
```

2. Copy the content below to `test/integration/electrodb/Collections.integration.test.ts`

## Test File Content

\`\`\`typescript
import {describe, test, expect, beforeAll, afterAll, beforeEach} from '@jest/globals'
import {setupLocalStackTable, cleanupLocalStackTable} from '../helpers/electrodb-localstack'
import {collections} from '../../../src/entities/Collections'
import {Users} from '../../../src/entities/Users'
import {Files} from '../../../src/entities/Files'
import {Devices} from '../../../src/entities/Devices'
import {UserFiles} from '../../../src/entities/UserFiles'
import {UserDevices} from '../../../src/entities/UserDevices'
import {FileStatus} from '../../../src/types/enums'

describe('ElectroDB Collections Integration', () => {
  beforeAll(async () => {
    await setupLocalStackTable()
  }, 30000)

  afterAll(async () => {
    await cleanupLocalStackTable()
  })

  beforeEach(async () => {
    const tableName = process.env.DynamoDBTableName || 'MediaDownloader'
    const {DynamoDBClient, ScanCommand, DeleteItemCommand} = await import('@aws-sdk/client-dynamodb')
    const client = new DynamoDBClient({
      endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    })

    const scanResult = await client.send(new ScanCommand({TableName: tableName}))
    if (scanResult.Items) {
      for (const item of scanResult.Items) {
        await client.send(
          new DeleteItemCommand({
            TableName: tableName,
            Key: {
              PK: item.PK,
              SK: item.SK
            }
          })
        )
      }
    }
  }, 30000)

  describe('userResources collection', () => {
    test('should query all files and devices for a user', async () => {
      const userId = 'test-user-1'
      const fileId1 = 'test-file-1'
      const fileId2 = 'test-file-2'
      const deviceId = 'test-device-1'

      await Users.create({
        userId,
        appleDeviceIdentifier: 'apple-123'
      }).go()

      await Files.create({
        fileId: fileId1,
        status: FileStatus.Downloaded,
        url: 'https://example.com/video1.mp4',
        availableAt: Date.now(),
        size: 1024000,
        authorName: 'Test Author',
        authorUser: 'testuser',
        publishDate: new Date().toISOString(),
        description: 'Test video 1',
        key: fileId1,
        contentType: 'video/mp4',
        title: 'Test Video 1'
      }).go()

      await Files.create({
        fileId: fileId2,
        status: FileStatus.PendingDownload,
        url: 'https://example.com/video2.mp4',
        availableAt: Date.now(),
        size: 2048000,
        authorName: 'Test Author',
        authorUser: 'testuser',
        publishDate: new Date().toISOString(),
        description: 'Test video 2',
        key: fileId2,
        contentType: 'video/mp4',
        title: 'Test Video 2'
      }).go()

      await Devices.create({
        deviceId,
        deviceToken: 'token-123',
        userId
      }).go()

      await UserFiles.create({userId, fileId: fileId1}).go()
      await UserFiles.create({userId, fileId: fileId2}).go()
      await UserDevices.create({userId, deviceId}).go()

      const result = await collections.userResources({userId}).go()

      expect(result.data.Users).toHaveLength(1)
      expect(result.data.Users[0].userId).toBe(userId)

      expect(result.data.Files).toHaveLength(2)
      const fileIds = result.data.Files.map((f) => f.fileId).sort()
      expect(fileIds).toEqual([fileId1, fileId2].sort())

      expect(result.data.UserFiles).toHaveLength(2)
      expect(result.data.UserDevices).toHaveLength(1)
      expect(result.data.UserDevices[0].deviceId).toBe(deviceId)
    }, 30000)

    test('should return empty arrays when user has no resources', async () => {
      const userId = 'test-user-empty'

      await Users.create({
        userId,
        appleDeviceIdentifier: 'apple-456'
      }).go()

      const result = await collections.userResources({userId}).go()

      expect(result.data.Users).toHaveLength(1)
      expect(result.data.Files).toHaveLength(0)
      expect(result.data.UserFiles).toHaveLength(0)
      expect(result.data.UserDevices).toHaveLength(0)
    }, 30000)
  })

  describe('fileUsers collection', () => {
    test('should query all users associated with a file', async () => {
      const fileId = 'shared-file-1'
      const userId1 = 'user-1'
      const userId2 = 'user-2'
      const userId3 = 'user-3'

      await Users.create({
        userId: userId1,
        appleDeviceIdentifier: 'apple-1'
      }).go()

      await Users.create({
        userId: userId2,
        appleDeviceIdentifier: 'apple-2'
      }).go()

      await Users.create({
        userId: userId3,
        appleDeviceIdentifier: 'apple-3'
      }).go()

      await Files.create({
        fileId,
        status: FileStatus.Downloaded,
        url: 'https://example.com/shared.mp4',
        availableAt: Date.now(),
        size: 5120000,
        authorName: 'Shared Author',
        authorUser: 'shareduser',
        publishDate: new Date().toISOString(),
        description: 'Shared video',
        key: fileId,
        contentType: 'video/mp4',
        title: 'Shared Video'
      }).go()

      await UserFiles.create({userId: userId1, fileId}).go()
      await UserFiles.create({userId: userId2, fileId}).go()
      await UserFiles.create({userId: userId3, fileId}).go()

      const result = await collections.fileUsers({fileId}).go()

      expect(result.data.Files).toHaveLength(1)
      expect(result.data.Files[0].fileId).toBe(fileId)

      expect(result.data.UserFiles).toHaveLength(3)
      const userIds = result.data.UserFiles.map((uf) => uf.userId).sort()
      expect(userIds).toEqual([userId1, userId2, userId3].sort())

      expect(result.data.Users).toHaveLength(3)
    }, 30000)

    test('should handle file with no associated users', async () => {
      const fileId = 'orphan-file'

      await Files.create({
        fileId,
        status: FileStatus.PendingDownload,
        url: 'https://example.com/orphan.mp4',
        availableAt: Date.now(),
        size: 1024000,
        authorName: 'Orphan Author',
        authorUser: 'orphanuser',
        publishDate: new Date().toISOString(),
        description: 'Orphan video',
        key: fileId,
        contentType: 'video/mp4',
        title: 'Orphan Video'
      }).go()

      const result = await collections.fileUsers({fileId}).go()

      expect(result.data.Files).toHaveLength(1)
      expect(result.data.UserFiles).toHaveLength(0)
      expect(result.data.Users).toHaveLength(0)
    }, 30000)
  })

  describe('batch operations', () => {
    test('should support batch get operations', async () => {
      const fileIds = ['batch-file-1', 'batch-file-2', 'batch-file-3']

      for (const fileId of fileIds) {
        await Files.create({
          fileId,
          status: FileStatus.Downloaded,
          url: \`https://example.com/\${fileId}.mp4\`,
          availableAt: Date.now(),
          size: 1024000,
          authorName: 'Batch Author',
          authorUser: 'batchuser',
          publishDate: new Date().toISOString(),
          description: \`Batch video \${fileId}\`,
          key: fileId,
          contentType: 'video/mp4',
          title: \`Batch Video \${fileId}\`
        }).go()
      }

      const result = await Files.get(fileIds.map((fileId) => ({fileId}))).go()

      expect(result.data).toHaveLength(3)
      const retrievedIds = (result.data as any[]).map((f) => f.fileId).sort()
      expect(retrievedIds).toEqual(fileIds.sort())
    }, 30000)
  })

  describe('query patterns', () => {
    test('should query files by status', async () => {
      const downloadedFile = 'downloaded-file'
      const pendingFile = 'pending-file'
      const failedFile = 'failed-file'

      await Files.create({
        fileId: downloadedFile,
        status: FileStatus.Downloaded,
        url: 'https://example.com/downloaded.mp4',
        availableAt: Date.now(),
        size: 1024000,
        authorName: 'Author',
        authorUser: 'user',
        publishDate: new Date().toISOString(),
        description: 'Downloaded video',
        key: downloadedFile,
        contentType: 'video/mp4',
        title: 'Downloaded Video'
      }).go()

      await Files.create({
        fileId: pendingFile,
        status: FileStatus.PendingDownload,
        url: 'https://example.com/pending.mp4',
        availableAt: Date.now(),
        size: 2048000,
        authorName: 'Author',
        authorUser: 'user',
        publishDate: new Date().toISOString(),
        description: 'Pending video',
        key: pendingFile,
        contentType: 'video/mp4',
        title: 'Pending Video'
      }).go()

      await Files.create({
        fileId: failedFile,
        status: FileStatus.FailedDownload,
        url: 'https://example.com/failed.mp4',
        availableAt: Date.now(),
        size: 3072000,
        authorName: 'Author',
        authorUser: 'user',
        publishDate: new Date().toISOString(),
        description: 'Failed video',
        key: failedFile,
        contentType: 'video/mp4',
        title: 'Failed Video'
      }).go()

      const downloadedResult = await Files.query.byStatus({status: FileStatus.Downloaded}).go()
      expect(downloadedResult.data).toHaveLength(1)
      expect(downloadedResult.data[0].fileId).toBe(downloadedFile)

      const pendingResult = await Files.query.byStatus({status: FileStatus.PendingDownload}).go()
      expect(pendingResult.data).toHaveLength(1)
      expect(pendingResult.data[0].fileId).toBe(pendingFile)
    }, 30000)
  })
})
\`\`\`

## Running the Tests

```bash
# Start LocalStack
npm run localstack:start

# Run integration tests (includes this file)
npm run test:integration

# Stop LocalStack
npm run localstack:stop
```

## What This Tests

1. **userResources Collection**: JOIN-like query to get all files and devices for a user
2. **fileUsers Collection**: Reverse lookup to get all users associated with a file (for notifications)
3. **Batch Operations**: Multiple items in a single query
4. **Query Patterns**: Status-based queries using GSIs
5. **Edge Cases**: Empty results, orphan entities

## Benefits

- Validates single-table design with ElectroDB
- Proves GSI configurations work correctly
- Tests real DynamoDB operations against LocalStack
- Ensures Collections produce expected JOIN behavior
- Validates entity relationships
