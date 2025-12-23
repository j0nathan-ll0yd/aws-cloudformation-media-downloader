import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {PutEventsResultEntry} from '#lib/vendor/AWS/EventBridge'
import {testContext} from '#util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
const fakeUserId = uuidv4()

const filesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

const userFilesMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))

jest.unstable_mockModule('#lib/vendor/AWS/SQS', () => ({
  sendMessage: jest.fn().mockReturnValue({
    MD5OfMessageBody: '44dd2fc26e4186dc12b8e67ccb9a9435',
    MD5OfMessageAttributes: 'e95833d661f4007f9575877843f475ed',
    MessageId: 'e990c66f-23f6-4982-9274-a5a533ceb6dc'
  }), // fmt: multiline
  subscribe: jest.fn(),
  stringAttribute: jest.fn((value: string) => ({DataType: 'String', StringValue: value})),
  numberAttribute: jest.fn((value: number) => ({DataType: 'Number', StringValue: value.toString()}))
}))

// Mock EventBridge for publishing events
const publishEventMock = jest.fn<(eventType: string, detail: object) => Promise<PutEventsResultEntry[]>>().mockResolvedValue([{EventId: 'test-event-id'}])
jest.unstable_mockModule('#lib/vendor/AWS/EventBridge',
  () => ({
    publishEvent: publishEventMock,
    EventType: {DownloadRequested: 'DownloadRequested', DownloadCompleted: 'DownloadCompleted', DownloadFailed: 'DownloadFailed'}
  }))

// Mock yt-dlp-wrap to prevent YouTube module from failing
class MockYTDlpWrap {
  constructor(public binaryPath: string) {}
  getVideoInfo = jest.fn()
}
jest.unstable_mockModule('yt-dlp-wrap', () => ({default: MockYTDlpWrap}))

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

const invokeAsyncMock = jest.fn()
jest.unstable_mockModule('#lib/vendor/AWS/Lambda', () => ({invokeAsync: invokeAsyncMock}))

// Mock Powertools idempotency (bypasses idempotency checks in tests)
const fileDownloadsMock = createElectroDBEntityMock()
jest.unstable_mockModule('#entities/FileDownloads',
  () => ({
    FileDownloads: fileDownloadsMock.entity,
    DownloadStatus: {Pending: 'Pending', InProgress: 'InProgress', Scheduled: 'Scheduled', Completed: 'Completed', Failed: 'Failed'}
  }))

jest.unstable_mockModule('#lib/vendor/Powertools/idempotency',
  () => ({createPersistenceStore: jest.fn(), defaultIdempotencyConfig: {}, makeIdempotent: jest.fn((fn: CallableFunction) => fn)}))

const {default: handleFeedlyEventResponse} = await import('./fixtures/handleFeedlyEvent-200-OK.json', {assert: {type: 'json'}})

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#WebhookFeedly', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
    jest.clearAllMocks()
    // Set required environment variables for sendFileNotification
    process.env.SNS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789/test-queue'
  })
  test('should continue processing when user-file association fails (graceful degradation)', async () => {
    // The code uses Promise.allSettled and logs the error but continues processing
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(handleFeedlyEventResponse)
    filesMock.mocks.get.mockResolvedValue({data: undefined})
    filesMock.mocks.create.mockResolvedValue({data: {}})
    fileDownloadsMock.mocks.create.mockResolvedValue({data: {}})
    userFilesMock.mocks.create.mockRejectedValue(new Error('Update failed'))
    const output = await handler(event, context)
    // Should return 202 and continue with event publishing despite association failure
    expect(output.statusCode).toEqual(202)
    expect(publishEventMock).toHaveBeenCalledTimes(1)
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

  test('should publish DownloadRequested event for new file and return 202', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    // Include backgroundMode: true to get 'Accepted' status response
    event.body = JSON.stringify({...handleFeedlyEventResponse, backgroundMode: true})

    // Mock: file doesn't exist (new file)
    filesMock.mocks.get.mockResolvedValue({data: undefined})
    // Mock: file creation succeeds
    filesMock.mocks.create.mockResolvedValue({data: {fileId: 'wRG7lAGdRII'}})
    // Mock: FileDownloads creation succeeds
    fileDownloadsMock.mocks.create.mockResolvedValue({data: {}})
    // Mock: user-file association succeeds
    userFilesMock.mocks.create.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    // Should return 202 Accepted for new file (backgroundMode defaults to true for Feedly)
    expect(output.statusCode).toEqual(202)
    const body = JSON.parse(output.body)
    expect(body.body.status).toEqual('Accepted')

    // Verify DownloadRequested event was published to EventBridge
    expect(publishEventMock).toHaveBeenCalledTimes(1)
    expect(publishEventMock).toHaveBeenCalledWith('DownloadRequested', expect.objectContaining({
      fileId: 'wRG7lAGdRII', // Video ID extracted from articleURL
      sourceUrl: 'https://www.youtube.com/watch?v=wRG7lAGdRII',
      backgroundMode: true,
      correlationId: expect.any(String)
    }))
  })

  test('should return 200 and send notification for already downloaded file without publishing event', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(handleFeedlyEventResponse)

    // Mock: file exists and is already downloaded
    filesMock.mocks.get.mockResolvedValue({
      data: {fileId: 'wRG7lAGdRII', status: 'Downloaded', title: 'Test Video', key: 'wRG7lAGdRII.mp4', size: 12345, contentType: 'video/mp4'}
    })
    // Mock: user-file association succeeds
    userFilesMock.mocks.create.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    // Should return 200 OK for already downloaded file
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(body.body.status).toEqual('Dispatched')

    // Verify NO DownloadRequested event was published (file already exists)
    expect(publishEventMock).not.toHaveBeenCalled()
  })

  test('should publish DownloadRequested event for existing queued file', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(handleFeedlyEventResponse)

    // Mock: file exists but is still queued (not downloaded)
    filesMock.mocks.get.mockResolvedValue({data: {fileId: 'wRG7lAGdRII', status: 'Queued', title: '', key: 'wRG7lAGdRII', size: 0, contentType: ''}})
    // Mock: user-file association succeeds
    userFilesMock.mocks.create.mockResolvedValue({data: {}})

    const output = await handler(event, context)

    // Should return 202 Accepted and publish event
    expect(output.statusCode).toEqual(202)

    // Verify DownloadRequested event was published to trigger download
    expect(publishEventMock).toHaveBeenCalledTimes(1)
    expect(publishEventMock).toHaveBeenCalledWith('DownloadRequested', expect.objectContaining({fileId: 'wRG7lAGdRII'}))
  })
})
