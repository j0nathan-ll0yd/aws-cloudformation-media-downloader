import {beforeEach, describe, expect, test, vi} from 'vitest'
import {testContext} from '#util/vitest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import type {SendMessageRequest} from '@aws-sdk/client-sqs'
import type {PutEventsResponse} from '@aws-sdk/client-eventbridge'
import type {MediaDownloaderEventType} from '#types/events'

const fakeUserId = uuidv4()

// Mock native Drizzle query functions
vi.mock('#entities/queries', () => ({getFile: vi.fn(), createFile: vi.fn(), createUserFile: vi.fn(), createFileDownload: vi.fn()}))

// Mock Powertools idempotency to bypass DynamoDB persistence
vi.mock('#lib/vendor/Powertools/idempotency', () => ({
  createPersistenceStore: vi.fn(),
  defaultIdempotencyConfig: {},
  // makeIdempotent passes through the function unchanged (no idempotency wrapping in tests)
  makeIdempotent: <T extends (...args: unknown[]) => unknown>(fn: T) => fn
}))

const sendMessageMock = vi.fn<(params: SendMessageRequest) => Promise<{MessageId: string}>>()
vi.mock('#lib/vendor/AWS/SQS',
  () => ({
    sendMessage: sendMessageMock,
    subscribe: vi.fn(),
    stringAttribute: vi.fn((value: string) => ({DataType: 'String', StringValue: value})),
    numberAttribute: vi.fn((value: number) => ({DataType: 'Number', StringValue: value.toString()}))
  }))

// Mock child_process for YouTube spawn operations
vi.mock('child_process', () => ({spawn: vi.fn()}))

// Mock fs for YouTube operations (createReadStream for S3 upload, promises for cookie/cleanup)
vi.mock('fs', () => ({createReadStream: vi.fn()}))
vi.mock('fs/promises', () => ({copyFile: vi.fn(), stat: vi.fn(), unlink: vi.fn()}))

// Mock S3 vendor wrapper for YouTube
vi.mock('#lib/vendor/AWS/S3', () => ({
  headObject: vi.fn(), // fmt: multiline
  createS3Upload: vi.fn().mockReturnValue({
    on: vi.fn(),
    done: vi.fn<() => Promise<{Location: string}>>().mockResolvedValue({Location: 's3://test-bucket/test-key.mp4'})
  })
}))

const publishEventMock = vi.fn<(eventType: MediaDownloaderEventType, detail: Record<string, unknown>) => Promise<PutEventsResponse>>()
vi.mock('#lib/vendor/AWS/EventBridge', () => ({publishEvent: publishEventMock}))

const {default: handleFeedlyEventResponse} = await import('./fixtures/handleFeedlyEvent-200-OK.json', {assert: {type: 'json'}})

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')
import {createFile, createFileDownload, createUserFile, getFile} from '#entities/queries'

// Mock return value factories matching Drizzle schema
const mockFileRow = () => ({
  fileId: 'test-file-id',
  key: 'test-key.mp4',
  authorName: 'Test Author',
  authorUser: 'test-user',
  publishDate: '2024-01-01',
  description: 'Test description',
  title: 'Test Title',
  status: 'Queued',
  size: 0,
  url: null,
  contentType: 'video/mp4'
})
const mockUserFileRow = () => ({userId: fakeUserId, fileId: 'test-file-id', createdAt: new Date()})
const mockFileDownloadRow = () => ({
  fileId: 'test-file-id',
  status: 'Pending',
  retryCount: 0,
  maxRetries: 5,
  retryAfter: null,
  errorCategory: null,
  lastError: null,
  scheduledReleaseTime: null,
  sourceUrl: null,
  correlationId: null,
  createdAt: new Date(),
  updatedAt: new Date()
})

describe('#WebhookFeedly', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    vi.clearAllMocks()
    process.env.EVENT_BUS_NAME = 'MediaDownloader'
    process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification'
    process.env.IDEMPOTENCY_TABLE_NAME = 'IdempotencyTable'
    publishEventMock.mockResolvedValue({FailedEntryCount: 0, Entries: [{EventId: 'event-123'}]})
    vi.mocked(createFileDownload).mockResolvedValue(mockFileDownloadRow())
    vi.mocked(createFile).mockResolvedValue(mockFileRow())
    vi.mocked(createUserFile).mockResolvedValue(mockUserFileRow())
    vi.mocked(getFile).mockResolvedValue(null)
    sendMessageMock.mockResolvedValue({MessageId: 'msg-123'})
  })
  test('should continue processing even if user-file association fails', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(handleFeedlyEventResponse)
    vi.mocked(getFile).mockResolvedValue(null)
    vi.mocked(createFile).mockResolvedValue(mockFileRow())
    vi.mocked(createUserFile).mockRejectedValue(new Error('Update failed'))
    const output = await handler(event, context)
    // Handler uses Promise.allSettled and continues even if association fails
    expect(output.statusCode).toEqual(202)
  })
  test('should handle an invalid request body', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify({})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).toHaveProperty('articleURL')
  })
  test('should return 401 when user ID is missing (unauthenticated)', async () => {
    // With Authorization header but unknown principalId = Unauthenticated
    event.requestContext.authorizer!.principalId = 'unknown'
    event.body = JSON.stringify(handleFeedlyEventResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })
  test('should return 401 for anonymous users (no auth header)', async () => {
    // Without Authorization header = Anonymous
    delete event.headers.Authorization
    event.requestContext.authorizer!.principalId = 'unknown'
    event.body = JSON.stringify(handleFeedlyEventResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })
  test('should handle an invalid event body', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = 'hello'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-4XX-generic')
    expect(body.error.message).toEqual('Request body must be valid JSON')
  })
  test('should publish DownloadRequested event for new files', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(handleFeedlyEventResponse)
    vi.mocked(getFile).mockResolvedValue(null)
    vi.mocked(createFile).mockResolvedValue(mockFileRow())
    vi.mocked(createUserFile).mockResolvedValue(mockUserFileRow())
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(202)
    const body = JSON.parse(output.body)
    expect(body.body.status).toEqual('Accepted')
    expect(publishEventMock).toHaveBeenCalledWith('DownloadRequested',
      expect.objectContaining({
        fileId: expect.any(String),
        userId: fakeUserId,
        sourceUrl: handleFeedlyEventResponse.articleURL,
        correlationId: expect.any(String),
        requestedAt: expect.any(String)
      }))
  })

  describe('#AlreadyDownloadedFile', () => {
    test('should send notification and return 200 when file is already downloaded', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(handleFeedlyEventResponse)
      vi.mocked(createUserFile).mockResolvedValue(mockUserFileRow())
      // Return an already-downloaded file
      vi.mocked(getFile).mockResolvedValue({
        fileId: 'wRG7lAGdRII',
        key: 'wRG7lAGdRII.mp4',
        status: 'Downloaded',
        size: 50000000,
        url: 'https://example.com/wRG7lAGdRII.mp4',
        authorName: 'Author',
        authorUser: 'author-user',
        publishDate: '2024-01-01',
        description: 'Desc',
        title: 'Title',
        contentType: 'video/mp4'
      })
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(200)
      const body = JSON.parse(output.body)
      expect(body.body.status).toEqual('Dispatched')
      // Should send notification, NOT publish download event
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          QueueUrl: 'https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification',
          MessageBody: expect.stringContaining('DownloadReadyNotification')
        })
      )
      expect(publishEventMock).not.toHaveBeenCalled()
    })
  })

  describe('#ExistingNonDownloadedFile', () => {
    test('should skip file creation but publish event for existing queued file', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(handleFeedlyEventResponse)
      vi.mocked(createUserFile).mockResolvedValue(mockUserFileRow())
      // Return an existing file that is still queued
      vi.mocked(getFile).mockResolvedValue({
        fileId: 'wRG7lAGdRII',
        key: 'wRG7lAGdRII.mp4',
        status: 'Queued',
        size: 0,
        url: null,
        authorName: 'Author',
        authorUser: 'author-user',
        publishDate: '2024-01-01',
        description: 'Desc',
        title: 'Title',
        contentType: 'video/mp4'
      })
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(202)
      // Should NOT create a new file record
      expect(vi.mocked(createFile)).not.toHaveBeenCalled()
      // Should still publish DownloadRequested event
      expect(publishEventMock).toHaveBeenCalledWith('DownloadRequested', expect.any(Object))
    })

    test('should skip file creation for existing downloading file', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(handleFeedlyEventResponse)
      vi.mocked(createUserFile).mockResolvedValue(mockUserFileRow())
      // Return an existing file that is currently downloading
      vi.mocked(getFile).mockResolvedValue({
        fileId: 'wRG7lAGdRII',
        key: 'wRG7lAGdRII.mp4',
        status: 'Downloading',
        size: 0,
        url: null,
        authorName: 'Author',
        authorUser: 'author-user',
        publishDate: '2024-01-01',
        description: 'Desc',
        title: 'Title',
        contentType: 'video/mp4'
      })
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(202)
      expect(vi.mocked(createFile)).not.toHaveBeenCalled()
    })
  })

  describe('#FailureHandling', () => {
    test('should return 500 when EventBridge publish fails', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(handleFeedlyEventResponse)
      vi.mocked(getFile).mockResolvedValue(null)
      vi.mocked(createFile).mockResolvedValue(mockFileRow())
      vi.mocked(createUserFile).mockResolvedValue(mockUserFileRow())
      publishEventMock.mockRejectedValue(new Error('EventBridge failure'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error.message).toEqual('EventBridge failure')
    })

    test('should return 500 when file creation fails', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(handleFeedlyEventResponse)
      vi.mocked(getFile).mockResolvedValue(null)
      vi.mocked(createFile).mockRejectedValue(new Error('DynamoDB write failed'))
      vi.mocked(createUserFile).mockResolvedValue(mockUserFileRow())
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error.message).toEqual('DynamoDB write failed')
    })
  })
})
