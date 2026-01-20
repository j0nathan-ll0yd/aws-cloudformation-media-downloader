import {afterAll, afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {createMockContext} from '#util/vitest-setup'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructureTypes'
import type {PutEventsResponse} from '@aws-sdk/client-eventbridge'
import type {MediaDownloaderEventType} from '#types/events'
import {createMockFile, createMockFileDownload, createMockUserFile, DEFAULT_USER_ID} from '#test/helpers/entity-fixtures'
import {createAPIGatewayEvent, createFeedlyWebhookBody} from '#test/helpers/event-factories'
import {SendMessageCommand} from '@aws-sdk/client-sqs'
import {createEventBridgePutEventsResponse, createSQSSendMessageResponse} from '#test/helpers/aws-response-factories'
import {createSQSMock, resetAllAwsMocks} from '#test/helpers/aws-sdk-mock'

const fakeUserId = DEFAULT_USER_ID

// Create SQS mock using helper - injects into vendor client factory
const sqsMock = createSQSMock()

vi.mock('#entities/queries', () => ({getFile: vi.fn(), createFile: vi.fn(), upsertUserFile: vi.fn(), createFileDownload: vi.fn()}))

// Mock EventBridge vendor wrapper (has retry logic that can cause test timeouts)
import type {PublishEventOptions} from '#lib/vendor/AWS/EventBridge'
const publishEventWithRetryMock = vi.fn<
  (eventType: MediaDownloaderEventType, detail: Record<string, unknown>, options?: PublishEventOptions) => Promise<PutEventsResponse>
>()
vi.mock('#lib/vendor/AWS/EventBridge', () => ({publishEventWithRetry: publishEventWithRetryMock}))

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

// Feedly webhook body content
const feedlyWebhookBody = {
  articleFirstImageURL: 'https://i.ytimg.com/vi/7jEzw5WLiMI/maxresdefault.jpg',
  articleCategories: 'YouTube',
  articlePublishedAt: 'April 27, 2020 at 04:10PM',
  articleTitle: 'WOW! Ariana Grande Meme Backlash & Meme War, COVID-19 Contact Tracing Problems, Mr. Beast & More',
  articleURL: 'https://www.youtube.com/watch?v=wRG7lAGdRII',
  createdAt: 'April 27, 2020 at 04:10PM',
  sourceFeedURL: 'https://www.youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw',
  sourceTitle: 'Philip DeFranco (uploads) on YouTube',
  sourceURL: 'https://youtube.com/playlist?list=UUlFSU9_bUb4Rc6OYfTt5SPw'
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

    process.env.EVENT_BUS_NAME = 'MediaDownloader'
    process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification'
    process.env.IDEMPOTENCY_TABLE_NAME = 'IdempotencyTable'

    // Configure AWS mock responses using factories
    sqsMock.on(SendMessageCommand).resolves(createSQSSendMessageResponse())
    publishEventWithRetryMock.mockResolvedValue(createEventBridgePutEventsResponse())

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
    // Verify EventBridge was called with DownloadRequested
    expect(publishEventWithRetryMock).toHaveBeenCalledWith('DownloadRequested',
      expect.objectContaining({fileId: expect.any(String), userId: fakeUserId, sourceUrl: feedlyWebhookBody.articleURL, requestedAt: expect.any(String)}),
      expect.any(Object))
  })

  describe('#AlreadyDownloadedFile', () => {
    test('should send notification and return 200 when file is already downloaded', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(feedlyWebhookBody)
      vi.mocked(upsertUserFile).mockResolvedValue(mockUserFileRow())
      // Return an already-downloaded file
      vi.mocked(getFile).mockResolvedValue(
        createMockFile({fileId: 'wRG7lAGdRII', status: 'Downloaded', size: 50000000, url: 'https://example.com/wRG7lAGdRII.mp4'})
      )
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(200)
      const body = JSON.parse(output.body)
      expect(body.body.status).toEqual('Dispatched')
      // Should send notification, NOT publish download event
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: 'https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification',
        MessageBody: expect.stringContaining('DownloadReadyNotification')
      })
      expect(publishEventWithRetryMock).not.toHaveBeenCalled()
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
      expect(publishEventWithRetryMock).toHaveBeenCalledWith('DownloadRequested', expect.any(Object), expect.any(Object))
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
      publishEventWithRetryMock.mockRejectedValue(new Error('EventBridge failure'))
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
})
