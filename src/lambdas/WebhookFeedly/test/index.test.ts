import {describe, expect, test, jest, beforeEach} from '@jest/globals'
import {testContext} from '../../../util/jest-setup'
import {v4 as uuidv4} from 'uuid'
import {CustomAPIGatewayRequestAuthorizerEvent} from '../../../types/main'
const fakeUserId = uuidv4()

const queryMock = jest.fn()
const updateItem = jest.fn().mockReturnValue({})
const deleteItemMock = jest.fn().mockReturnValue({})
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  updateItem: updateItem,
  deleteItem: deleteItemMock,
  query: queryMock,
  scan: jest.fn()
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/SQS', () => ({
  sendMessage: jest.fn().mockReturnValue({
    MD5OfMessageBody: '44dd2fc26e4186dc12b8e67ccb9a9435',
    MD5OfMessageAttributes: 'e95833d661f4007f9575877843f475ed',
    MessageId: 'e990c66f-23f6-4982-9274-a5a533ceb6dc'
  }),
  subscribe: jest.fn()
}))

jest.unstable_mockModule('../../../lib/vendor/AWS/StepFunctions', () => ({
  startExecution: jest.fn().mockReturnValue({
    executionArn: 'arn:aws:states:us-west-2:203465012143:execution:MultipartUpload:1666060419059',
    startDate: new Date()
  })
}))

// Mock yt-dlp-wrap to prevent YouTube module from failing
jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: jest.fn()
}))

// Mock child_process for YouTube spawn operations
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}))

// Mock fs for YouTube cookie operations
jest.unstable_mockModule('fs', () => ({
  promises: {
    copyFile: jest.fn<() => Promise<void>>()
  }
}))

// Mock AWS SDK for YouTube
jest.unstable_mockModule('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn()
}))

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  HeadObjectCommand: jest.fn()
}))

const {default: handleFeedlyEventResponse} = await import('./fixtures/handleFeedlyEvent-200-OK.json', {assert: {type: 'json'}})
const {default: queryNoContentResponse} = await import('./fixtures/query-204-NoContent.json', {assert: {type: 'json'}})
const {default: querySuccessResponse} = await import('./fixtures/query-200-OK.json', {assert: {type: 'json'}})

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#WebhookFeedly', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
  })
  test('should trigger the download of a new file immediately (if not present)', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(handleFeedlyEventResponse)
    queryMock.mockReturnValue(queryNoContentResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(202)
    const body = JSON.parse(output.body)
    expect(body.body.status).toEqual('Initiated')
  })
  test('should trigger the download of a new file later (if not present)', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    const eventBody = handleFeedlyEventResponse
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    eventBody.backgroundMode = 1
    event.body = JSON.stringify(eventBody)
    queryMock.mockReturnValue(queryNoContentResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(202)
    const body = JSON.parse(output.body)
    expect(body.body.status).toEqual('Accepted')
  })
  test('should dispatch a message to the users device (if the file already exists)', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    queryMock.mockReturnValue(querySuccessResponse)
    event.body = JSON.stringify(handleFeedlyEventResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    const body = JSON.parse(output.body)
    expect(body.body.status).toEqual('Dispatched')
  })
  test('should fail gracefully if the startExecution fails', async () => {
    event.requestContext.authorizer!.principalId = fakeUserId
    event.body = JSON.stringify(handleFeedlyEventResponse)
    updateItem.mockImplementation(() => {
      throw new Error('Update failed')
    })
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)
  })
  test('should handle an invalid request body', async () => {
    event.body = JSON.stringify({})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).toHaveProperty('articleURL')
    expect(body.error.message.articleURL[0]).toEqual('articleURL is required')
  })
  test('should handle a missing user ID', async () => {
    event.requestContext.authorizer!.principalId = 'unknown'
    event.body = JSON.stringify(handleFeedlyEventResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(500)
    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-5XX-generic')
    expect(body.error.message).toEqual('AWS request failed')
  })
  test('should handle an invalid event body', async () => {
    event.body = 'hello'
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.code).toEqual('custom-4XX-generic')
    expect(body.error.message).toEqual('Request body must be valid JSON')
  })
  test('should handle an invalid (non-YouTube) URL', async () => {
    const {default: handleFeedlyEventInvalidResponse} = await import('./fixtures/handleFeedlyEvent-400-InvalidURL.json', {assert: {type: 'json'}})
    event.body = JSON.stringify(handleFeedlyEventInvalidResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(400)
    const body = JSON.parse(output.body)
    expect(body.error.message).toHaveProperty('articleURL')
    expect(body.error.message.articleURL[0]).toEqual('is not a valid YouTube URL')
  })
})
