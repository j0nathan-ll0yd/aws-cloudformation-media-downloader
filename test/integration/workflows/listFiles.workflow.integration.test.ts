/**
 * ListFiles Workflow Integration Tests
 *
 * Tests the file listing workflow against LocalStack:
 * 1. Extract userId and userStatus from event (custom authorizer)
 * 2. Handle different user statuses (Authenticated, Anonymous, Unauthenticated)
 * 3. Query DynamoDB UserFiles table for user's file IDs
 * 4. BatchGet files from Files table
 * 5. Filter to only Downloaded files
 * 6. Return file list to client
 *
 * This tests YOUR orchestration logic, not AWS SDK behavior.
 */

// Test configuration
const TEST_TABLE = 'test-list-files'

// Set environment variables for Lambda
process.env.DynamoDBTableName = TEST_TABLE
process.env.USE_LOCALSTACK = 'true'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {FileStatus, UserStatus} from '#types/enums'
import type {DynamoDBFile} from '#types/main'

// Test helpers
import {createFilesTable, deleteFilesTable} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
import {createMockFile, createMockUserFile} from '../helpers/test-data'

import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'
import {CustomAPIGatewayRequestAuthorizerEvent} from '#types/main'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const userFilesModulePath = resolve(__dirname, '../../../src/entities/UserFiles')
const filesModulePath = resolve(__dirname, '../../../src/entities/Files')

const userFilesMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
jest.unstable_mockModule(userFilesModulePath, () => ({UserFiles: userFilesMock.entity}))

const filesMock = createElectroDBEntityMock()
jest.unstable_mockModule(filesModulePath, () => ({Files: filesMock.entity}))

const {handler} = await import('../../../src/lambdas/ListFiles/src/index')

function createListFilesEvent(userId: string | undefined, userStatus: UserStatus): CustomAPIGatewayRequestAuthorizerEvent {
  return {
    body: null,
    headers: userId && userStatus === UserStatus.Authenticated
      ? {Authorization: 'Bearer test-token'}
      : userStatus === UserStatus.Unauthenticated
      ? {Authorization: 'Bearer invalid-token'}
      : {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/files',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/files',
      stage: 'test',
      requestId: 'test-request',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/files',
      authorizer: {
        principalId: userStatus === UserStatus.Unauthenticated ? 'unknown' : userId || 'anonymous',
        userId,
        userStatus,
        integrationLatency: 342
      },
      identity: {sourceIp: '127.0.0.1', userAgent: 'test-agent'}
    },
    resource: '/files'
  } as unknown as CustomAPIGatewayRequestAuthorizerEvent
}

describe('ListFiles Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    // Create LocalStack infrastructure
    await createFilesTable()

    // Wait for tables to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Create mock context
    mockContext = createMockContext()
  })

  afterAll(async () => {
    // Clean up LocalStack infrastructure
    await deleteFilesTable()
  })

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  test('should query UserFiles and return Downloaded files for authenticated user', async () => {
    // Arrange: Mock ElectroDB responses
    // UserFiles.query.byUser returns array of individual UserFile records
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: [
        createMockUserFile('user-abc-123', 'video-1'),
        createMockUserFile('user-abc-123', 'video-2'),
        createMockUserFile('user-abc-123', 'video-3')
      ]
    })

    // Files.get now uses BATCH get - returns array of files with unprocessed
    filesMock.mocks.get.mockResolvedValue({
      data: [
        createMockFile('video-1', FileStatus.Downloaded, {title: 'Video 1'}),
        createMockFile('video-2', FileStatus.Downloaded, {title: 'Video 2', size: 10485760}),
        createMockFile('video-3', FileStatus.PendingDownload, {title: 'Video 3 (not ready)'})
      ],
      unprocessed: []
    })

    const event = createListFilesEvent('user-abc-123', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
    expect(response.body.contents[0].fileId).toBe('video-1')
    expect(response.body.contents[1].fileId).toBe('video-2')

    expect(userFilesMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(1)
    expect(filesMock.mocks.get).toHaveBeenCalledTimes(1)
  })

  test('should return empty list when user has no files', async () => {
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: []})

    const event = createListFilesEvent('user-no-files', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.keyCount).toBe(0)
    expect(response.body.contents).toHaveLength(0)

    expect(userFilesMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(1)
    expect(filesMock.mocks.get).not.toHaveBeenCalled()
  })

  test('should return demo file for anonymous user without querying DynamoDB', async () => {
    const event = createListFilesEvent(undefined, UserStatus.Anonymous)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(1)
    expect(response.body.contents).toHaveLength(1)
    expect(response.body.contents[0]).toHaveProperty('fileId')

    expect(userFilesMock.mocks.query.byUser!.go).not.toHaveBeenCalled()
    expect(filesMock.mocks.get).not.toHaveBeenCalled()
  })

  test('should return 401 for unauthenticated user', async () => {
    const event = createListFilesEvent(undefined, UserStatus.Unauthenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(401)

    expect(userFilesMock.mocks.query.byUser!.go).not.toHaveBeenCalled()
    expect(filesMock.mocks.get).not.toHaveBeenCalled()
  })

  test('should filter out non-Downloaded files (Pending, Failed, PendingDownload)', async () => {
    // Arrange: Mock ElectroDB responses with mixed file statuses
    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({
      data: [
        createMockUserFile('user-mixed-files', 'downloaded-1'),
        createMockUserFile('user-mixed-files', 'downloaded-2'),
        createMockUserFile('user-mixed-files', 'pending-1'),
        createMockUserFile('user-mixed-files', 'failed-1'),
        createMockUserFile('user-mixed-files', 'pending-download-1')
      ]
    })

    // Files.get now uses BATCH get - returns array of all files
    filesMock.mocks.get.mockResolvedValue({
      data: [
        createMockFile('downloaded-1', FileStatus.Downloaded, {title: 'Downloaded 1'}),
        createMockFile('downloaded-2', FileStatus.Downloaded, {title: 'Downloaded 2'}),
        createMockFile('pending-1', FileStatus.PendingMetadata, {title: 'Pending 1'}),
        createMockFile('failed-1', FileStatus.Failed, {title: 'Failed 1'}),
        createMockFile('pending-download-1', FileStatus.PendingDownload, {title: 'Pending Download 1'})
      ],
      unprocessed: []
    })

    const event = createListFilesEvent('user-mixed-files', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(2)
    expect(response.body.contents).toHaveLength(2)
    expect(response.body.contents[0].status).toBe(FileStatus.Downloaded)
    expect(response.body.contents[1].status).toBe(FileStatus.Downloaded)

    const fileIds = response.body.contents.map((file: Partial<DynamoDBFile>) => file.fileId).sort()
    expect(fileIds).toEqual(['downloaded-1', 'downloaded-2'])
  })

  test('should handle large batch of files efficiently', async () => {
    // Arrange: Mock ElectroDB with 50 files
    const fileIds = Array.from({length: 50}, (_, i) => `video-${i}`)

    userFilesMock.mocks.query.byUser!.go.mockResolvedValue({data: fileIds.map((fileId) => createMockUserFile('user-many-files', fileId))})

    // Files.get now uses BATCH get - returns array of all 50 files at once
    filesMock.mocks.get.mockResolvedValue({
      data: fileIds.map((fileId, index) =>
        createMockFile(fileId, index % 2 === 0 ? FileStatus.Downloaded : FileStatus.PendingDownload, {title: `Video ${index}`})
      ),
      unprocessed: []
    })

    const event = createListFilesEvent('user-many-files', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)

    expect(response.body.keyCount).toBe(25)
    expect(response.body.contents).toHaveLength(25)
    expect(response.body.contents.every((file: Partial<DynamoDBFile>) => file.status === FileStatus.Downloaded)).toBe(true)
  })

  test('should handle DynamoDB errors gracefully', async () => {
    userFilesMock.mocks.query.byUser!.go.mockRejectedValue(new Error('DynamoDB service unavailable'))

    const event = createListFilesEvent('user-error', UserStatus.Authenticated)

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(500)

    expect(userFilesMock.mocks.query.byUser!.go).toHaveBeenCalledTimes(1)
    expect(filesMock.mocks.get).not.toHaveBeenCalled()
  })
})
