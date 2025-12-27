import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {testContext} from '#util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {createEntityMock} from '#test/helpers/entity-mock'
import {FileStatus} from '#types/enums'
import type {SendMessageRequest} from '@aws-sdk/client-sqs'
import type {PutEventsResponse} from '@aws-sdk/client-eventbridge'
import type {MediaDownloaderEventType} from '#types/events'

const fakeUserId = uuidv4()

const filesMock = createEntityMock()
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

const userFilesMock = createEntityMock()
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

const fileDownloadsMock = createEntityMock()
jest.unstable_mockModule('#entities/FileDownloads',
  () => ({
    FileDownloads: fileDownloadsMock.entity,
    DownloadStatus: {Pending: 'pending', InProgress: 'in_progress', Completed: 'completed', Failed: 'failed', Scheduled: 'scheduled'}
  }))

// Mock Powertools idempotency to bypass DynamoDB persistence
jest.unstable_mockModule('#lib/vendor/Powertools/idempotency', () => ({
  createPersistenceStore: jest.fn(),
  defaultIdempotencyConfig: {},
  // makeIdempotent passes through the function unchanged (no idempotency wrapping in tests)
  makeIdempotent: <T extends (...args: unknown[]) => unknown>(fn: T) => fn
}))

const sendMessageMock = jest.fn<(params: SendMessageRequest) => Promise<{MessageId: string}>>()
jest.unstable_mockModule('#lib/vendor/AWS/SQS',
  () => ({
    sendMessage: sendMessageMock,
    subscribe: jest.fn(),
    stringAttribute: jest.fn((value: string) => ({DataType: 'String', StringValue: value})),
    numberAttribute: jest.fn((value: number) => ({DataType: 'Number', StringValue: value.toString()}))
  }))

// Mock child_process for YouTube spawn operations
jest.unstable_mockModule('child_process', () => ({spawn: jest.fn()}))

// Mock fs for YouTube operations (createReadStream for S3 upload, promises for cookie/cleanup)
jest.unstable_mockModule('fs', () => ({createReadStream: jest.fn()}))
jest.unstable_mockModule('fs/promises', () => ({copyFile: jest.fn(), stat: jest.fn(), unlink: jest.fn()}))

// Mock S3 vendor wrapper for YouTube
jest.unstable_mockModule('#lib/vendor/AWS/S3', () => ({
  headObject: jest.fn(), // fmt: multiline
  createS3Upload: jest.fn().mockReturnValue({
    on: jest.fn(),
    done: jest.fn<() => Promise<{Location: string}>>().mockResolvedValue({Location: 's3://test-bucket/test-key.mp4'})
  })
}))

const publishEventMock = jest.fn<(eventType: MediaDownloaderEventType, detail: Record<string, unknown>) => Promise<PutEventsResponse>>()
jest.unstable_mockModule('#lib/vendor/AWS/EventBridge', () => ({publishEvent: publishEventMock}))

const {default: handleFeedlyEventResponse} = await import('./fixtures/handleFeedlyEvent-200-OK.json', {assert: {type: 'json'}})

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#WebhookFeedly', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    jest.clearAllMocks()
    process.env.EVENT_BUS_NAME = 'MediaDownloader'
    process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/SendPushNotification'
    process.env.IDEMPOTENCY_TABLE_NAME = 'IdempotencyTable'
    publishEventMock.mockResolvedValue({FailedEntryCount: 0, Entries: [{EventId: 'event-123'}]})
    fileDownloadsMock.mocks.create.mockResolvedValue({data: {}})
    sendMessageMock.mockResolvedValue({MessageId: 'msg-123'})
  })
  test('should continue processing even if user-file association fails', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(handleFeedlyEventResponse)
    filesMock.mocks.get.mockResolvedValue({data: undefined})
    filesMock.mocks.create.mockResolvedValue({data: {}})
    userFilesMock.mocks.create.mockRejectedValue(new Error('Update failed'))
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
    filesMock.mocks.get.mockResolvedValue({data: undefined})
    filesMock.mocks.create.mockResolvedValue({data: {}})
    userFilesMock.mocks.create.mockResolvedValue({data: {}})
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
      userFilesMock.mocks.create.mockResolvedValue({data: {}})
      // Return an already-downloaded file
      filesMock.mocks.get.mockResolvedValue({
        data: {fileId: 'wRG7lAGdRII', key: 'wRG7lAGdRII.mp4', status: FileStatus.Downloaded, size: 50000000, url: 'https://example.com/wRG7lAGdRII.mp4'}
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
      userFilesMock.mocks.create.mockResolvedValue({data: {}})
      // Return an existing file that is still queued
      filesMock.mocks.get.mockResolvedValue({data: {fileId: 'wRG7lAGdRII', key: 'wRG7lAGdRII.mp4', status: FileStatus.Queued, size: 0}})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(202)
      // Should NOT create a new file record
      expect(filesMock.mocks.create).not.toHaveBeenCalled()
      // Should still publish DownloadRequested event
      expect(publishEventMock).toHaveBeenCalledWith('DownloadRequested', expect.any(Object))
    })

    test('should skip file creation for existing downloading file', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(handleFeedlyEventResponse)
      userFilesMock.mocks.create.mockResolvedValue({data: {}})
      // Return an existing file that is currently downloading
      filesMock.mocks.get.mockResolvedValue({data: {fileId: 'wRG7lAGdRII', key: 'wRG7lAGdRII.mp4', status: FileStatus.Downloading, size: 0}})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(202)
      expect(filesMock.mocks.create).not.toHaveBeenCalled()
    })
  })

  describe('#FailureHandling', () => {
    test('should return 500 when EventBridge publish fails', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(handleFeedlyEventResponse)
      filesMock.mocks.get.mockResolvedValue({data: undefined})
      filesMock.mocks.create.mockResolvedValue({data: {}})
      userFilesMock.mocks.create.mockResolvedValue({data: {}})
      publishEventMock.mockRejectedValue(new Error('EventBridge failure'))
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error.message).toEqual('EventBridge failure')
    })

    test('should return 500 when file creation fails', async () => {
      event.requestContext.authorizer!.principalId = fakeUserId
      event.body = JSON.stringify(handleFeedlyEventResponse)
      filesMock.mocks.get.mockResolvedValue({data: undefined})
      filesMock.mocks.create.mockRejectedValue(new Error('DynamoDB write failed'))
      userFilesMock.mocks.create.mockResolvedValue({data: {}})
      const output = await handler(event, context)
      expect(output.statusCode).toEqual(500)
      const body = JSON.parse(output.body)
      expect(body.error.message).toEqual('DynamoDB write failed')
    })
  })
})
