/**
 * WebhookFeedly Workflow Integration Tests
 *
 * Tests the Feedly webhook workflow against LocalStack:
 * 1. Extract video ID from article URL
 * 2. Associate file with user in DynamoDB
 * 3. Check if file already exists (Downloaded → send SQS, new → add to DynamoDB)
 * 4. Handle duplicate webhooks (idempotency)
 */

const TEST_TABLE = 'test-files-webhook'
const TEST_SQS_QUEUE_URL = 'http://localhost:4566/000000000000/test-notifications'
const TEST_IDEMPOTENCY_TABLE = 'test-idempotency-webhook'

process.env.DYNAMODB_TABLE_NAME = TEST_TABLE
process.env.SNS_QUEUE_URL = TEST_SQS_QUEUE_URL
process.env.USE_LOCALSTACK = 'true'
process.env.IDEMPOTENCY_TABLE_NAME = TEST_IDEMPOTENCY_TABLE

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {FileStatus} from '#types/enums'
import type {CustomAPIGatewayRequestAuthorizerEvent} from '#types/infrastructure-types'
import {createFilesTable, createIdempotencyTable, deleteFilesTable, deleteIdempotencyTable, getFile, insertFile} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'

interface FileInvocationPayload {
  fileId: string
}
type SQSCallArgs = [
  {QueueUrl: string; MessageBody: string; MessageAttributes?: Record<string, {StringValue: string; DataType: string}>}
]

const {default: apiGatewayEventFixture} = await import('../../../src/lambdas/WebhookFeedly/test/fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})

// Use path aliases matching handler imports for proper mock resolution
const sendMessageMock = jest.fn<() => Promise<{MessageId: string}>>()
jest.unstable_mockModule('#lib/vendor/AWS/SQS',
  () => ({
    sendMessage: sendMessageMock,
    stringAttribute: jest.fn((value: string) => ({DataType: 'String', StringValue: value})),
    numberAttribute: jest.fn((value: number) => ({DataType: 'Number', StringValue: value.toString()}))
  }))

const invokeLambdaMock = jest.fn<(name: string, payload: FileInvocationPayload) => Promise<{StatusCode: number}>>()
jest.unstable_mockModule('#lib/vendor/AWS/Lambda', () => ({invokeLambda: invokeLambdaMock, invokeAsync: invokeLambdaMock}))

// Mock EventBridge for publishing DownloadRequested events
import type {PutEventsResultEntry} from '#lib/vendor/AWS/EventBridge'
const publishEventMock = jest.fn<(eventType: string, detail: object) => Promise<PutEventsResultEntry[]>>().mockResolvedValue([{EventId: 'test-event-id'}])
jest.unstable_mockModule('#lib/vendor/AWS/EventBridge',
  () => ({
    publishEvent: publishEventMock,
    EventType: {DownloadRequested: 'DownloadRequested', DownloadCompleted: 'DownloadCompleted', DownloadFailed: 'DownloadFailed'}
  }))

jest.unstable_mockModule('#lib/vendor/YouTube', () => ({
  getVideoID: jest.fn((url: string) => {
    const match = url.match(/v=([^&]+)/)
    return match ? match[1] : 'test-video-id'
  })
}))

const {handler} = await import('../../../src/lambdas/WebhookFeedly/src/index')

function createWebhookEvent(articleURL: string, backgroundMode: boolean, userId: string): CustomAPIGatewayRequestAuthorizerEvent {
  const event = JSON.parse(JSON.stringify(apiGatewayEventFixture)) as CustomAPIGatewayRequestAuthorizerEvent
  event.body = JSON.stringify({articleURL, backgroundMode})
  event.requestContext.authorizer.principalId = userId
  return event
}

describe('WebhookFeedly Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await Promise.all([createFilesTable(), createIdempotencyTable()])
    await new Promise((resolve) => setTimeout(resolve, 1000))
    mockContext = createMockContext()
  })

  afterAll(async () => {
    await Promise.all([deleteFilesTable(), deleteIdempotencyTable()])
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    sendMessageMock.mockClear()
    invokeLambdaMock.mockClear()
    publishEventMock.mockClear()

    sendMessageMock.mockResolvedValue({MessageId: 'test-message-id'})
    invokeLambdaMock.mockResolvedValue({StatusCode: 202})
    publishEventMock.mockResolvedValue([{EventId: 'test-event-id'}])

    // Recreate tables for clean state each test
    await Promise.all([deleteFilesTable(), deleteIdempotencyTable()])
    await Promise.all([createFilesTable(), createIdempotencyTable()])
    await new Promise((resolve) => setTimeout(resolve, 500))
  })

  test('should create new file and initiate download', async () => {
    const event = createWebhookEvent('https://www.youtube.com/watch?v=new-video-123', false, 'user-uuid-123')

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(202)
    const response = JSON.parse(result.body)
    expect(response.body.status).toBe('Initiated')

    const file = await getFile('new-video-123')
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe('new-video-123')
    expect(file!.status).toBe(FileStatus.Queued)

    // Verify DownloadRequested event was published to EventBridge
    expect(publishEventMock).toHaveBeenCalledTimes(1)
    expect(publishEventMock).toHaveBeenCalledWith('DownloadRequested', expect.objectContaining({fileId: 'new-video-123'}))

    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  test('should send notification without re-downloading for existing file', async () => {
    await insertFile({
      fileId: 'existing-video',
      status: FileStatus.Downloaded,
      key: 'existing-video.mp4',
      size: 5242880,
      title: 'Existing Video',
      authorName: 'Test Channel',
      contentType: 'video/mp4'
    })

    const event = createWebhookEvent('https://www.youtube.com/watch?v=existing-video', false, 'user-uuid-456')

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.status).toBe('Dispatched')

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    const messageParams = (sendMessageMock.mock.calls as unknown as SQSCallArgs[])[0][0]
    expect(messageParams.QueueUrl).toBe(TEST_SQS_QUEUE_URL)
    // Verify message body is JSON with DownloadReadyNotification format
    const messageBody = JSON.parse(messageParams.MessageBody)
    expect(messageBody.notificationType).toBe('DownloadReadyNotification')
    expect(messageBody.file.fileId).toBe('existing-video')

    // File already downloaded - no EventBridge event published
    expect(publishEventMock).not.toHaveBeenCalled()

    const file = await getFile('existing-video')
    expect(file!.status).toBe(FileStatus.Downloaded)
  })

  test('should handle backgroundMode without immediate download', async () => {
    const event = createWebhookEvent('https://www.youtube.com/watch?v=background-video', true, 'user-uuid-789')

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(202)
    const response = JSON.parse(result.body)
    expect(response.body.status).toBe('Accepted')

    const file = await getFile('background-video')
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe('background-video')
    expect(file!.status).toBe(FileStatus.Queued)

    // EventBridge event is always published (backgroundMode only affects response status)
    expect(publishEventMock).toHaveBeenCalledTimes(1)
    expect(publishEventMock).toHaveBeenCalledWith('DownloadRequested', expect.objectContaining({fileId: 'background-video', backgroundMode: true}))
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  test('should be idempotent when receiving duplicate webhooks', async () => {
    const event = createWebhookEvent('https://www.youtube.com/watch?v=duplicate-video', false, 'user-uuid-101')

    const result1 = await handler(event, mockContext)
    const result2 = await handler(event, mockContext)

    expect(result1.statusCode).toBe(202)
    expect(result2.statusCode).toBe(202)

    const file = await getFile('duplicate-video')
    expect(file).not.toBeNull()
    expect(file!.fileId).toBe('duplicate-video')

    // EventBridge event is published for each webhook (idempotency is at event processing level)
    expect(publishEventMock).toHaveBeenCalledTimes(2)
  })

  test('should associate file with multiple users', async () => {
    await insertFile({fileId: 'shared-video', status: FileStatus.Downloaded, key: 'shared-video.mp4', size: 5242880, title: 'Shared Video'})

    const event1 = createWebhookEvent('https://www.youtube.com/watch?v=shared-video', false, 'user-alice')
    const event2 = createWebhookEvent('https://www.youtube.com/watch?v=shared-video', false, 'user-bob')

    const result1 = await handler(event1, mockContext)
    const result2 = await handler(event2, mockContext)

    expect(result1.statusCode).toBe(200)
    expect(result2.statusCode).toBe(200)

    expect(sendMessageMock).toHaveBeenCalledTimes(2)

    const messages = sendMessageMock.mock.calls as unknown as SQSCallArgs[]
    const message1Attrs = messages[0][0].MessageAttributes!
    const message2Attrs = messages[1][0].MessageAttributes!

    expect(message1Attrs.userId.StringValue).toBe('user-alice')
    expect(message2Attrs.userId.StringValue).toBe('user-bob')

    expect(invokeLambdaMock).not.toHaveBeenCalled()
  })

  test('should handle invalid video URL gracefully', async () => {
    const event = createWebhookEvent('https://invalid-url.com/not-youtube', false, 'user-uuid-999')

    const result = await handler(event, mockContext)

    expect(result.statusCode).toBe(400)
    expect(invokeLambdaMock).not.toHaveBeenCalled()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
