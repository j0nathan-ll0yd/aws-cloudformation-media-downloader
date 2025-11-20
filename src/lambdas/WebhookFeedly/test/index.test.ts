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

// Mock yt-dlp-wrap to prevent YouTube module from failing
class MockYTDlpWrap {
  constructor(public binaryPath: string) {}
  getVideoInfo = jest.fn()
}
jest.unstable_mockModule('yt-dlp-wrap', () => ({
  default: MockYTDlpWrap
}))

// Mock child_process for YouTube spawn operations
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}))

// Mock fs for YouTube cookie operations
jest.unstable_mockModule('fs', () => ({
  promises: {
    copyFile: jest.fn()
  }
}))

// Mock S3 vendor wrapper for YouTube
jest.unstable_mockModule('../../../lib/vendor/AWS/S3', () => ({
  headObject: jest.fn<() => Promise<{ContentLength: number}>>(),
  createS3Upload: jest.fn().mockReturnValue({
    on: jest.fn(),
    done: jest.fn<() => Promise<{Location: string}>>().mockResolvedValue({Location: 's3://test-bucket/test-key.mp4'})
  })
}))

const invokeAsyncMock = jest.fn<() => Promise<{StatusCode: number}>>()
jest.unstable_mockModule('../../../lib/vendor/AWS/Lambda', () => ({
  invokeAsync: invokeAsyncMock
}))

const {default: handleFeedlyEventResponse} = await import('./fixtures/handleFeedlyEvent-200-OK.json', {assert: {type: 'json'}})

const {default: eventMock} = await import('./fixtures/APIGatewayEvent.json', {assert: {type: 'json'}})
const {handler} = await import('./../src')

describe('#WebhookFeedly', () => {
  const context = testContext
  let event: CustomAPIGatewayRequestAuthorizerEvent
  beforeEach(() => {
    event = JSON.parse(JSON.stringify(eventMock))
  })
  test('should fail gracefully if the DynamoDB update fails', async () => {
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
})
