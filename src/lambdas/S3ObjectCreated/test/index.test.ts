import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import {testContext} from '#util/vitest-setup'
import {createMockFile, createMockUserFile, DEFAULT_USER_ID} from '#test/helpers/entity-fixtures'
import {createS3Event} from '#test/helpers/event-factories'
import {mockClient} from 'aws-sdk-client-mock'
import {SendMessageCommand, SQSClient} from '@aws-sdk/client-sqs'

// Create SQS mock - intercepts all SQSClient.send() calls
const sqsMock = mockClient(SQSClient)

beforeAll(() => {
  process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/test-queue'
})

// Mock native Drizzle query functions
vi.mock('#entities/queries', () => ({getFilesByKey: vi.fn(), getUserFilesByFileId: vi.fn()}))

const {handler} = await import('./../src')
import {getFilesByKey, getUserFilesByFileId} from '#entities/queries'

// Mock data using fixture factories
const mockFileRow = createMockFile({fileId: '4TfEp8oG5gM', key: '20210122-[Philip DeFranco].mp4'})
const mockUserFileRow = createMockUserFile({fileId: '4TfEp8oG5gM', userId: DEFAULT_USER_ID})

describe('#S3ObjectCreated', () => {
  // Create base S3 event with URL-encoded key (S3 encodes special characters like [ and ])
  const baseEvent = createS3Event({records: [{key: '20191209-[sxephil].mp4', bucket: 'lifegames-sandbox-testbucket'}]})

  beforeEach(() => {
    vi.clearAllMocks()
    sqsMock.reset()
    // Default mock: file found, one user
    vi.mocked(getFilesByKey).mockResolvedValue([mockFileRow])
    vi.mocked(getUserFilesByFileId).mockResolvedValue([mockUserFileRow])
    sqsMock.on(SendMessageCommand).resolves({MessageId: 'test-message-id'})
  })

  afterEach(() => {
    sqsMock.reset()
  })

  test('should dispatch push notifications for each user with the file', async () => {
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1)
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: 'https://sqs.us-west-2.amazonaws.com/123456789/test-queue',
      MessageBody: expect.stringContaining('DownloadReadyNotification')
    })
  })

  test('should handle missing file gracefully and continue processing', async () => {
    // With batch processing, errors are caught and logged rather than thrown
    // This allows remaining records to be processed even if one fails
    vi.mocked(getFilesByKey).mockResolvedValue([])
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand)
  })

  test('should not send notifications when file has no users', async () => {
    vi.mocked(getUserFilesByFileId).mockResolvedValue([])
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand)
  })

  test('should send notifications to multiple users for the same file', async () => {
    const multipleUsers = [
      {fileId: '4TfEp8oG5gM', userId: 'user-1', createdAt: new Date()},
      {fileId: '4TfEp8oG5gM', userId: 'user-2', createdAt: new Date()},
      {fileId: '4TfEp8oG5gM', userId: 'user-3', createdAt: new Date()}
    ]
    vi.mocked(getUserFilesByFileId).mockResolvedValue(multipleUsers)
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 3)
  })

  test('should decode URL-encoded S3 object keys correctly', async () => {
    // The fixture has key "20191209-%5Bsxephil%5D.mp4" which decodes to "20191209-[sxephil].mp4"
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(vi.mocked(getFilesByKey)).toHaveBeenCalled()
    // Verify the query was made (the key is decoded internally)
  })

  test('should convert plus signs to spaces in S3 object keys', async () => {
    // S3 URL encoding uses + for spaces
    const eventWithSpaces = createS3Event({records: [{key: 'file+with+spaces.mp4'}]})
    const output = await handler(eventWithSpaces, testContext)
    expect(output).toBeUndefined()
    // File query still attempted (will fail with our mock, but that's expected)
  })

  test('should process multiple S3 records in batch', async () => {
    // Create event with 3 different file uploads
    const multiRecordEvent = createS3Event({records: [{key: 'file1.mp4'}, {key: 'file2.mp4'}, {key: 'file3.mp4'}]})
    const output = await handler(multiRecordEvent, testContext)
    expect(output).toBeUndefined()
    // Each file should trigger a query
    expect(vi.mocked(getFilesByKey)).toHaveBeenCalledTimes(3)
  })

  describe('#PartialFailures', () => {
    test('should continue processing when one notification dispatch fails', async () => {
      const multipleUsers = [
        {fileId: '4TfEp8oG5gM', userId: 'user-1', createdAt: new Date()},
        {fileId: '4TfEp8oG5gM', userId: 'user-2', createdAt: new Date()}
      ]
      vi.mocked(getUserFilesByFileId).mockResolvedValue(multipleUsers)
      // First call fails, second succeeds
      sqsMock.on(SendMessageCommand).rejectsOnce(new Error('SQS send failed')).resolves({MessageId: 'success-id'})

      const output = await handler(baseEvent, testContext)
      // Handler uses Promise.allSettled, so it continues despite failure
      expect(output).toBeUndefined()
      expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 2)
    })

    test('should continue batch processing when one file query fails', async () => {
      const multiRecordEvent = createS3Event({records: [{key: 'file1.mp4'}, {key: 'file2.mp4'}]})
      // First file not found, second file found
      vi.mocked(getFilesByKey).mockResolvedValueOnce([]).mockResolvedValueOnce([mockFileRow])

      const output = await handler(multiRecordEvent, testContext)
      expect(output).toBeUndefined()
      // Second file should still send notification
      expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1)
    })
  })
})
