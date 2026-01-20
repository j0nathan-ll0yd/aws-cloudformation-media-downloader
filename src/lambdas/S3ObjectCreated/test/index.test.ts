import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import {createMockContext} from '#util/vitest-setup'
import {createMockFile, createMockUserFile, DEFAULT_USER_ID} from '#test/helpers/entity-fixtures'
import {createS3Event} from '#test/helpers/event-factories'
import {SendMessageCommand} from '@aws-sdk/client-sqs'
import {createSQSSendMessageResponse} from '#test/helpers/aws-response-factories'
import {createSQSMock, resetAllAwsMocks} from '#test/helpers/aws-sdk-mock'
import {TEST_BUCKET_NAME_SANDBOX, TEST_S3_KEY_DECODED, TEST_S3_KEY_WITH_BRACKETS, TEST_SQS_QUEUE_URL, TEST_VIDEO_ID_ALT} from '#test/helpers/test-constants'

// Create SQS mock using helper - injects into vendor client factory
const sqsMock = createSQSMock()

beforeAll(() => {
  process.env.SNS_QUEUE_URL = TEST_SQS_QUEUE_URL
})

vi.mock('#entities/queries', () => ({getFilesByKey: vi.fn(), getUserFilesByFileId: vi.fn()}))

const {handler} = await import('./../src')
import {getFilesByKey, getUserFilesByFileId} from '#entities/queries'

const mockFileRow = createMockFile({fileId: TEST_VIDEO_ID_ALT, key: TEST_S3_KEY_WITH_BRACKETS})
const mockUserFileRow = createMockUserFile({fileId: TEST_VIDEO_ID_ALT, userId: DEFAULT_USER_ID})

describe('#S3ObjectCreated', () => {
  // Create base S3 event with URL-encoded key (S3 encodes special characters like [ and ])
  const baseEvent = createS3Event({records: [{key: TEST_S3_KEY_DECODED, bucket: TEST_BUCKET_NAME_SANDBOX}]})

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: file found, one user
    vi.mocked(getFilesByKey).mockResolvedValue([mockFileRow])
    vi.mocked(getUserFilesByFileId).mockResolvedValue([mockUserFileRow])
    sqsMock.on(SendMessageCommand).resolves(createSQSSendMessageResponse())
  })

  afterEach(() => {
    sqsMock.reset()
  })

  afterAll(() => {
    resetAllAwsMocks()
  })

  test('should dispatch push notifications for each user with the file', async () => {
    const output = await handler(baseEvent, createMockContext())
    expect(output).toBeUndefined()
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1)
    expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
      QueueUrl: TEST_SQS_QUEUE_URL,
      MessageBody: expect.stringContaining('DownloadReadyNotification')
    })
  })

  test('should handle missing file gracefully and continue processing', async () => {
    // With batch processing, errors are caught and logged rather than thrown
    // This allows remaining records to be processed even if one fails
    vi.mocked(getFilesByKey).mockResolvedValue([])
    const output = await handler(baseEvent, createMockContext())
    expect(output).toBeUndefined()
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand)
  })

  test('should not send notifications when file has no users', async () => {
    vi.mocked(getUserFilesByFileId).mockResolvedValue([])
    const output = await handler(baseEvent, createMockContext())
    expect(output).toBeUndefined()
    expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand)
  })

  test('should send notifications to multiple users for the same file', async () => {
    const multipleUsers = [
      createMockUserFile({fileId: TEST_VIDEO_ID_ALT, userId: 'user-1'}),
      createMockUserFile({fileId: TEST_VIDEO_ID_ALT, userId: 'user-2'}),
      createMockUserFile({fileId: TEST_VIDEO_ID_ALT, userId: 'user-3'})
    ]
    vi.mocked(getUserFilesByFileId).mockResolvedValue(multipleUsers)
    const output = await handler(baseEvent, createMockContext())
    expect(output).toBeUndefined()
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 3)
  })

  test('should decode URL-encoded S3 object keys correctly', async () => {
    // The fixture has key "20191209-%5Bsxephil%5D.mp4" which decodes to "20191209-[sxephil].mp4"
    const output = await handler(baseEvent, createMockContext())
    expect(output).toBeUndefined()
    expect(vi.mocked(getFilesByKey)).toHaveBeenCalled()
    // Verify the query was made (the key is decoded internally)
  })

  test('should convert plus signs to spaces in S3 object keys', async () => {
    // S3 URL encoding uses + for spaces
    const eventWithSpaces = createS3Event({records: [{key: 'file+with+spaces.mp4'}]})
    const output = await handler(eventWithSpaces, createMockContext())
    expect(output).toBeUndefined()
    // File query still attempted (will fail with our mock, but that's expected)
  })

  test('should process multiple S3 records in batch', async () => {
    // Create event with 3 different file uploads
    const multiRecordEvent = createS3Event({records: [{key: 'file1.mp4'}, {key: 'file2.mp4'}, {key: 'file3.mp4'}]})
    const output = await handler(multiRecordEvent, createMockContext())
    expect(output).toBeUndefined()
    // Each file should trigger a query
    expect(vi.mocked(getFilesByKey)).toHaveBeenCalledTimes(3)
  })

  describe('#PartialFailures', () => {
    test('should continue processing when one notification dispatch fails', async () => {
      const multipleUsers = [
        createMockUserFile({fileId: TEST_VIDEO_ID_ALT, userId: 'user-1'}),
        createMockUserFile({fileId: TEST_VIDEO_ID_ALT, userId: 'user-2'})
      ]
      vi.mocked(getUserFilesByFileId).mockResolvedValue(multipleUsers)
      // First call fails, second succeeds
      sqsMock.on(SendMessageCommand).rejectsOnce(new Error('SQS send failed')).resolves(createSQSSendMessageResponse())

      const output = await handler(baseEvent, createMockContext())
      // Handler uses Promise.allSettled, so it continues despite failure
      expect(output).toBeUndefined()
      expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 2)
    })

    test('should continue batch processing when one file query fails', async () => {
      const multiRecordEvent = createS3Event({records: [{key: 'file1.mp4'}, {key: 'file2.mp4'}]})
      // First file not found, second file found
      vi.mocked(getFilesByKey).mockResolvedValueOnce([]).mockResolvedValueOnce([mockFileRow])

      const output = await handler(multiRecordEvent, createMockContext())
      expect(output).toBeUndefined()
      // Second file should still send notification
      expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1)
    })
  })

  describe('#EdgeCases', () => {
    test('should handle database timeout during file lookup', async () => {
      const timeoutError = new Error('Query timeout after 30000ms')
      Object.assign(timeoutError, {code: 'ETIMEDOUT'})
      vi.mocked(getFilesByKey).mockRejectedValue(timeoutError)

      const output = await handler(baseEvent, createMockContext())
      // Handler catches error and continues (no SQS message sent)
      expect(output).toBeUndefined()
      expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand)
    })

    test('should handle database timeout during user lookup', async () => {
      const timeoutError = new Error('Query timeout after 30000ms')
      Object.assign(timeoutError, {code: 'ETIMEDOUT'})
      vi.mocked(getFilesByKey).mockResolvedValue([mockFileRow])
      vi.mocked(getUserFilesByFileId).mockRejectedValue(timeoutError)

      const output = await handler(baseEvent, createMockContext())
      expect(output).toBeUndefined()
      expect(sqsMock).not.toHaveReceivedCommand(SendMessageCommand)
    })

    test('should handle S3 key with complex URL encoding', async () => {
      // S3 URL encodes special characters like spaces, brackets, etc.
      const complexKeyEvent = createS3Event({records: [{key: 'file%20with%20spaces%5Bbrackets%5D.mp4'}]})

      const output = await handler(complexKeyEvent, createMockContext())
      expect(output).toBeUndefined()
      // Query should have been attempted (even if file not found with our mock)
      expect(vi.mocked(getFilesByKey)).toHaveBeenCalled()
    })

    test('should handle empty S3 records array gracefully', async () => {
      const emptyEvent = createS3Event({records: []})

      const output = await handler(emptyEvent, createMockContext())
      expect(output).toBeUndefined()
      expect(vi.mocked(getFilesByKey)).not.toHaveBeenCalled()
    })
  })
})
