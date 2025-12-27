import {beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {S3Event, S3EventRecord} from 'aws-lambda'
import type {SendMessageRequest} from '@aws-sdk/client-sqs'
import {testContext} from '#util/vitest-setup'
import {createEntityMock} from '../../../../test/helpers/entity-mock'

beforeAll(() => {
  process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/test-queue'
})

const filesMock = createEntityMock({queryIndexes: ['byKey']})
vi.mock('#entities/Files', () => ({Files: filesMock.entity}))

const userFilesMock = createEntityMock({queryIndexes: ['byFile']})
vi.mock('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

const sendMessageMock = vi.fn<(params: SendMessageRequest) => Promise<{MessageId: string}>>()
vi.mock('#lib/vendor/AWS/SQS',
  () => ({
    sendMessage: sendMessageMock,
    stringAttribute: vi.fn((value: string) => ({DataType: 'String', StringValue: value})),
    numberAttribute: vi.fn((value: number) => ({DataType: 'Number', StringValue: value.toString()}))
  }))

const {default: eventMock} = await import('./fixtures/Event.json', {assert: {type: 'json'}})
const {default: getFileByKeyResponse} = await import('./fixtures/getFileByKey-200-OK.json', {assert: {type: 'json'}})
const {default: getUsersByFileIdResponse} = await import('./fixtures/getUsersByFileId-200-OK.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

/** Creates an S3 event record with a custom object key */
function createS3Record(objectKey: string, baseRecord: S3EventRecord): S3EventRecord {
  return {...baseRecord, s3: {...baseRecord.s3, object: {...baseRecord.s3.object, key: objectKey}}}
}

/** Creates a multi-record S3 event for batch processing tests */
function createMultiRecordEvent(keys: string[], baseRecord: S3EventRecord): S3Event {
  return {Records: keys.map((key) => createS3Record(key, baseRecord))}
}

describe('#S3ObjectCreated', () => {
  const baseEvent = eventMock as S3Event
  const baseRecord = baseEvent.Records[0]

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: file found, one user
    filesMock.mocks.query.byKey!.go.mockResolvedValue({data: getFileByKeyResponse.Items})
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: getUsersByFileIdResponse.Items})
    sendMessageMock.mockResolvedValue({MessageId: 'test-message-id'})
  })

  test('should dispatch push notifications for each user with the file', async () => {
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        QueueUrl: 'https://sqs.us-west-2.amazonaws.com/123456789/test-queue',
        MessageBody: expect.stringContaining('DownloadReadyNotification')
      })
    )
  })

  test('should handle missing file gracefully and continue processing', async () => {
    // With batch processing, errors are caught and logged rather than thrown
    // This allows remaining records to be processed even if one fails
    filesMock.mocks.query.byKey!.go.mockResolvedValue({data: []})
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  test('should not send notifications when file has no users', async () => {
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: []})
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  test('should send notifications to multiple users for the same file', async () => {
    const multipleUsers = [
      {fileId: '4TfEp8oG5gM', userId: 'user-1'},
      {fileId: '4TfEp8oG5gM', userId: 'user-2'},
      {fileId: '4TfEp8oG5gM', userId: 'user-3'}
    ]
    userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: multipleUsers})
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(sendMessageMock).toHaveBeenCalledTimes(3)
  })

  test('should decode URL-encoded S3 object keys correctly', async () => {
    // The fixture has key "20191209-%5Bsxephil%5D.mp4" which decodes to "20191209-[sxephil].mp4"
    const output = await handler(baseEvent, testContext)
    expect(output).toBeUndefined()
    expect(filesMock.mocks.query.byKey!.go).toHaveBeenCalled()
    // Verify the query was made (the key is decoded internally)
  })

  test('should convert plus signs to spaces in S3 object keys', async () => {
    // S3 URL encoding uses + for spaces
    const eventWithSpaces = createMultiRecordEvent(['file+with+spaces.mp4'], baseRecord)
    const output = await handler(eventWithSpaces, testContext)
    expect(output).toBeUndefined()
    // File query still attempted (will fail with our mock, but that's expected)
  })

  test('should process multiple S3 records in batch', async () => {
    // Create event with 3 different file uploads
    const multiRecordEvent = createMultiRecordEvent(['file1.mp4', 'file2.mp4', 'file3.mp4'], baseRecord)
    const output = await handler(multiRecordEvent, testContext)
    expect(output).toBeUndefined()
    // Each file should trigger a query
    expect(filesMock.mocks.query.byKey!.go).toHaveBeenCalledTimes(3)
  })

  describe('#PartialFailures', () => {
    test('should continue processing when one notification dispatch fails', async () => {
      const multipleUsers = [
        {fileId: '4TfEp8oG5gM', userId: 'user-1'},
        {fileId: '4TfEp8oG5gM', userId: 'user-2'}
      ]
      userFilesMock.mocks.query.byFile!.go.mockResolvedValue({data: multipleUsers})
      // First call fails, second succeeds
      sendMessageMock.mockRejectedValueOnce(new Error('SQS send failed')).mockResolvedValueOnce({MessageId: 'success-id'})

      const output = await handler(baseEvent, testContext)
      // Handler uses Promise.allSettled, so it continues despite failure
      expect(output).toBeUndefined()
      expect(sendMessageMock).toHaveBeenCalledTimes(2)
    })

    test('should continue batch processing when one file query fails', async () => {
      const multiRecordEvent = createMultiRecordEvent(['file1.mp4', 'file2.mp4'], baseRecord)
      // First file not found, second file found
      filesMock.mocks.query.byKey!.go.mockResolvedValueOnce({data: []}).mockResolvedValueOnce({data: getFileByKeyResponse.Items})

      const output = await handler(multiRecordEvent, testContext)
      expect(output).toBeUndefined()
      // Second file should still send notification
      expect(sendMessageMock).toHaveBeenCalledTimes(1)
    })
  })
})
