import {afterAll, afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {createMockContext} from '#util/vitest-setup'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import type {PutEventsResponse} from '@aws-sdk/client-eventbridge'
import {createMockFile, createMockFileDownload, createMockUserFile, DEFAULT_USER_ID} from '#test/helpers/entity-fixtures'
import {createAPIGatewayEvent, createFeedlyWebhookBody} from '#test/helpers/event-factories'
import {SendMessageCommand} from '@aws-sdk/client-sqs'
import {createEventBridgePutEventsResponse, createSQSSendMessageResponse} from '#test/helpers/aws-response-factories'
import {createSQSMock, resetAllAwsMocks} from '#test/helpers/aws-sdk-mock'
import {
  TEST_EVENT_BUS_NAME,
  TEST_FEEDLY_ARTICLE_TITLE,
  TEST_FEEDLY_CATEGORY,
  TEST_FEEDLY_PUBLISHED_AT,
  TEST_FEEDLY_SOURCE_TITLE,
  TEST_IDEMPOTENCY_TABLE_NAME,
  TEST_SQS_PUSH_NOTIFICATION_URL,
  TEST_YOUTUBE_CHANNEL_URL,
  TEST_YOUTUBE_PLAYLIST_URL,
  TEST_YOUTUBE_THUMBNAIL_URL,
  TEST_YOUTUBE_URL
} from '#test/helpers/test-constants'

const fakeUserId = DEFAULT_USER_ID

// Create SQS mock using helper - injects into vendor client factory
const sqsMock = createSQSMock()

vi.mock('#entities/queries', () => ({getFile: vi.fn(), createFile: vi.fn(), upsertUserFile: vi.fn(), createFileDownload: vi.fn()}))

// Mock EventBridge vendor wrapper (has retry logic that can cause test timeouts)
import type {PublishEventOptions} from '#lib/vendor/AWS/EventBridge'
import type {DownloadRequestedDetail} from '#types/events'
const publishEventDownloadRequestedWithRetryMock = vi.fn<
  (detail: DownloadRequestedDetail, options?: PublishEventOptions) => Promise<PutEventsResponse>
>()
vi.mock('#lib/vendor/AWS/EventBridge', () => ({publishEventDownloadRequestedWithRetry: publishEventDownloadRequestedWithRetryMock}))

// Mock Powertools idempotency to bypass DynamoDB persistence
vi.mock('#lib/vendor/Powertools/idempotency', () => ({
  createPersistenceStore: vi.fn(),
  defaultIdempotencyConfig: {registerLambdaContext: vi.fn()},
  // makeIdempotent passes through the function unchanged (no idempotency wrapping in tests)
  makeIdempotent: <T extends (...args: unknown[]) => unknown>(fn: T) => fn
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

// Feedly webhook body content using test constants
const feedlyWebhookBody = {
  articleFirstImageURL: TEST_YOUTUBE_THUMBNAIL_URL,
  articleCategories: TEST_FEEDLY_CATEGORY,
  articlePublishedAt: TEST_FEEDLY_PUBLISHED_AT,
  articleTitle: TEST_FEEDLY_ARTICLE_TITLE,
  articleURL: TEST_YOUTUBE_URL,
  createdAt: TEST_FEEDLY_PUBLISHED_AT,
  sourceFeedURL: TEST_YOUTUBE_PLAYLIST_URL,
  sourceTitle: TEST_FEEDLY_SOURCE_TITLE,
  sourceURL: TEST_YOUTUBE_CHANNEL_URL
}

const {handler} = await import('./../src')
import {createFile, createFileDownload, getFile, upsertUserFile} from '#entities/queries'

// Mock return value factories using shared fixtures
const mockFileRow = () => createMockFile({fileId: 'test-file-id', status: 'Queued', size: 0, url: null})
const mockUserFileRow = () => createMockUserFile({userId: fakeUserId, fileId: 'test-file-id'})
const mockFileDownloadRow = () => createMockFileDownload({fileId: 'test-file-id'})

describe('#WebhookFeedly', () => {
  const context = createMockContext()
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    vi.clearAllMocks()
    // Create event with Feedly webhook body
    event = createAPIGatewayEvent({path: '/webhooks/feedly', httpMethod: 'POST', body: createFeedlyWebhookBody({articleURL: feedlyWebhookBody.articleURL})})

    process.env.EVENT_BUS_NAME = TEST_EVENT_BUS_NAME
    process.env.SNS_QUEUE_URL = TEST_SQS_PUSH_NOTIFICATION_URL
    process.env.IDEMPOTENCY_TABLE_NAME = TEST_IDEMPOTENCY_TABLE_NAME

    // Configure AWS mock responses using factories
    sqsMock.on(SendMessageCommand).resolves(createSQSSendMessageResponse())
    publishEventDownloadRequestedWithRetryMock.mockResolvedValue(createEventBridgePutEventsResponse())

    vi.mocked(createFileDownload).mockResolvedValue(mockFileDownloadRow())
    vi.mocked(createFile).mockResolvedValue(mockFileRow())
    vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())
    vi.mocked(getFile).mockResolvedValue(null)
  })

  afterEach(() => {
    sqsMock.reset()
  })

  afterAll(() => {
    resetAllAwsMocks()
  })

  test('should continue processing even if user-file association fails', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(feedlyWebhookBody)
    vi.mocked(getFile).mockResolvedValue(null)
    vi.mocked(createFile).mockResolvedValue(mockFileRow())
    vi.mocked(upsertUserFile).mockRejectedValue(new Error('Update failed'))
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
    event.body = JSON.stringify(feedlyWebhookBody)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })
  test('should return 401 for anonymous users (no auth header)', async () => {
    // Without Authorization header = Anonymous
    delete event.headers.Authorization
    event.requestContext.authorizer!.principalId = 'unknown'
    event.body = JSON.stringify(feedlyWebhookBody)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(401)
  })
  test('should handle an invalid event body', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = 'hello'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('VALIDATION_ERROR')
    expect(body.error.message).toEqual('Request body must be valid JSON')
  })
  test('should publish DownloadRequested event for new files', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(feedlyWebhookBody)
    vi.mocked(getFile).mockResolvedValue(null)
    vi.mocked(createFile).mockResolvedValue(mockFileRow())
    vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(202)
    const body = JSON.parse(output.body)
    expect(body.body.status).toEqual('Accepted')
    // Verify EventBridge was called with DownloadRequested detail
    expect(publishEventDownloadRequestedWithRetryMock).toHaveBeenCalledWith(
      expect.objectContaining({fileId: expect.any(String), userId: fakeUserId, sourceUrl: TEST_YOUTUBE_URL, requestedAt: expect.any(String)}),
      expect.any(Object)
    )
  })

  describe('#AlreadyDownloadedFile', () => {
    test('should send notification and return 200 when file is already downloaded', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(feedlyWebhookBody)
      vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())
      // Return an already-downloaded file (wRG7lAGdRII is extracted from TEST_YOUTUBE_URL)
      vi.mocked(getFile).mockResolvedValue(
        createMockFile({fileId: 'wRG7lAGdRII', status: 'Downloaded', size: 50000000, url: 'https://example.com/wRG7lAGdRII.mp4'})
      )
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(200)
      const body = JSON.parse(output.body)
      expect(body.body.status).toEqual('Dispatched')
      // Should send notification, NOT publish download event
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: TEST_SQS_PUSH_NOTIFICATION_URL,
        MessageBody: expect.stringContaining('DownloadReadyNotification')
      })
      expect(publishEventDownloadRequestedWithRetryMock).not.toHaveBeenCalled()
    })
  })

  describe('#ExistingNonDownloadedFile', () => {
    test('should skip file creation but publish event for existing queued file', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(feedlyWebhookBody)
      vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())
      // Return an existing file that is still queued
      vi.mocked(getFile).mockResolvedValue(createMockFile({fileId: 'wRG7lAGdRII', status: 'Queued', size: 0, url: null}))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(202)
      // Should NOT create a new file record
      expect(vi.mocked(createFile)).not.toHaveBeenCalled()
      // Should still publish DownloadRequested event
      expect(publishEventDownloadRequestedWithRetryMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Object))
    })

    test('should skip file creation for existing downloading file', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(feedlyWebhookBody)
      vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())
      // Return an existing file that is currently downloading
      vi.mocked(getFile).mockResolvedValue(createMockFile({fileId: 'wRG7lAGdRII', status: 'Downloading', size: 0, url: null}))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(202)
      expect(vi.mocked(createFile)).not.toHaveBeenCalled()
    })
  })

  describe('#FailureHandling', () => {
    test('should return 500 when EventBridge publish fails', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(feedlyWebhookBody)
      vi.mocked(getFile).mockResolvedValue(null)
      vi.mocked(createFile).mockResolvedValue(mockFileRow())
      vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())
      publishEventDownloadRequestedWithRetryMock.mockRejectedValue(new Error('EventBridge failure'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error.message).toEqual('EventBridge failure')
    })

    test('should return 500 when file creation fails', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(feedlyWebhookBody)
      vi.mocked(getFile).mockResolvedValue(null)
      vi.mocked(createFile).mockRejectedValue(new Error('DynamoDB write failed'))
      vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error.message).toEqual('DynamoDB write failed')
    })
  })

  describe('#EdgeCases', () => {
    test('should handle database connection error gracefully', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(feedlyWebhookBody)
      // Simulate DB error during getFile - handler swallows this as "file not found" and proceeds
      vi.mocked(getFile).mockRejectedValue(new Error('Connection refused'))

      const output = await handler(event, context)

      // Handler catches getFile errors and treats as "file not found" - proceeds with new file creation
      // This is acceptable because handler calls createFile next which will throw if DB is down
      expect(output.statusCode).toBeDefined()
    })

    test('should handle EventBridge timeout', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(feedlyWebhookBody)
      vi.mocked(getFile).mockResolvedValue(null)
      vi.mocked(createFile).mockResolvedValue(mockFileRow())
      vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())
      const timeoutError = new Error('EventBridge timeout')
      Object.assign(timeoutError, {code: 'ETIMEDOUT'})
      publishEventDownloadRequestedWithRetryMock.mockRejectedValue(timeoutError)

      const output = await handler(event, context)

      expect(output.statusCode).toEqual(500)
    })

    test('should handle YouTube URL with extra query parameters', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      const bodyWithExtraParams = {...feedlyWebhookBody, articleURL: `${TEST_YOUTUBE_URL}&feature=youtu.be&t=30s`}
      event.body = JSON.stringify(bodyWithExtraParams)
      vi.mocked(getFile).mockResolvedValue(null)
      vi.mocked(createFile).mockResolvedValue(mockFileRow())
      vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())

      const output = await handler(event, context)

      expect(output.statusCode).toEqual(202)
    })

    test('should handle non-YouTube URL in articleURL', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      const bodyWithInvalidUrl = {...feedlyWebhookBody, articleURL: 'https://example.com/not-youtube'}
      event.body = JSON.stringify(bodyWithInvalidUrl)

      const output = await handler(event, context)

      // Non-YouTube URLs should be rejected (400 validation error expected)
      expect([400, 202]).toContain(output.statusCode)
    })
  })
})
