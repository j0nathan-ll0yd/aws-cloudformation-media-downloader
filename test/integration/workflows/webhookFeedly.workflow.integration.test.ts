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

process.env.DynamoDBTableName = TEST_TABLE
process.env.SNSQueueUrl = TEST_SQS_QUEUE_URL
process.env.USE_LOCALSTACK = 'true'

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from '@jest/globals'
import type {Context} from 'aws-lambda'
import {FileStatus} from '../../../src/types/enums'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../src/types/main'
import {createFilesTable, deleteFilesTable, getFile, insertFile} from '../helpers/dynamodb-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {fileURLToPath} from 'url'
import {dirname, resolve} from 'path'

interface FileInvocationPayload {
  fileId: string
}

type LambdaCallArgs = [string, Record<string, unknown>]
type SQSCallArgs = [
  { QueueUrl: string; MessageBody: string; MessageAttributes?: Record<string, { StringValue: string; DataType: string }> }
]

const { default: apiGatewayEventFixture } = await import(
  '../../../src/lambdas/WebhookFeedly/test/fixtures/APIGatewayEvent.json',
  { assert: { type: 'json' } }
)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const sqsModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/SQS')
const lambdaModulePath = resolve(__dirname, '../../../src/lib/vendor/AWS/Lambda')
const youtubeModulePath = resolve(__dirname, '../../../src/lib/vendor/YouTube')

const sendMessageMock = jest.fn<() => Promise<{ MessageId: string }>>()
jest.unstable_mockModule(
  sqsModulePath,
  () => ({
    sendMessage: sendMessageMock,
    stringAttribute: jest.fn((value: string) => ({ DataType: 'String', StringValue: value })),
    numberAttribute: jest.fn((value: number) => ({ DataType: 'Number', StringValue: value.toString() }))
  })
)

const invokeLambdaMock = jest.fn<() => Promise<{ StatusCode: number }>>()
jest.unstable_mockModule(lambdaModulePath, () => ({ invokeLambda: invokeLambdaMock, invokeAsync: invokeLambdaMock }))

jest.unstable_mockModule(youtubeModulePath, () => ({
  getVideoID: jest.fn((url: string) => {
    const match = url.match(/v=([^&]+)/)
    return match ? match[1] : 'test-video-id'
  })
}))

const { handler } = await import('../../../src/lambdas/WebhookFeedly/src/index')

function createWebhookEvent(
  articleURL: string,
  backgroundMode: boolean,
  userId: string
): CustomAPIGatewayRequestAuthorizerEvent {
  const event = JSON.parse(JSON.stringify(apiGatewayEventFixture)) as CustomAPIGatewayRequestAuthorizerEvent
  event.body = JSON.stringify({ articleURL, backgroundMode })
  event.requestContext.authorizer.principalId = userId
  return event
}

describe('WebhookFeedly Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await createFilesTable()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    mockContext = createMockContext()
  })

  afterAll(async () => {
    await deleteFilesTable()
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    sendMessageMock.mockClear()
    invokeLambdaMock.mockClear()

    sendMessageMock.mockResolvedValue({ MessageId: 'test-message-id' })
    invokeLambdaMock.mockResolvedValue({ StatusCode: 202 })

    await deleteFilesTable()
    await createFilesTable()
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
    expect(file!.status).toBe(FileStatus.PendingMetadata)

    expect(invokeLambdaMock).toHaveBeenCalledTimes(1)
    const invocationPayload = (invokeLambdaMock.mock.calls as unknown as LambdaCallArgs[])[0][
      1
    ] as unknown as FileInvocationPayload
    expect(invocationPayload.fileId).toBe('new-video-123')

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
    expect(messageParams.MessageBody).toBe('FileNotification')

    expect(invokeLambdaMock).not.toHaveBeenCalled()

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
    expect(file!.status).toBe(FileStatus.PendingMetadata)

    // FileCoordinator will pick up this file later
    expect(invokeLambdaMock).not.toHaveBeenCalled()
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

    // StartFileUpload uses conditional updates for deduplication
    expect(invokeLambdaMock).toHaveBeenCalledTimes(2)
  })

  test('should associate file with multiple users', async () => {
    await insertFile({
      fileId: 'shared-video',
      status: FileStatus.Downloaded,
      key: 'shared-video.mp4',
      size: 5242880,
      title: 'Shared Video'
    })

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
