import {testContext} from '../../../util/jest-setup'
import {describe, expect, test, jest} from '@jest/globals'
const {default: eventMock} = await import('./fixtures/ScheduledEvent.json', {assert: {type: 'json'}})

const scanMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/AWS/DynamoDB', () => ({
  scan: scanMock,
  deleteItem: jest.fn(),
  query: jest.fn(),
  updateItem: jest.fn()
}))
const sendMock = jest.fn<() => Promise<unknown>>()
jest.unstable_mockModule('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn(() => ({
    send: sendMock
  })),
  InvokeCommand: jest.fn((params: unknown) => params)
}))

const {handler} = await import('./../src')

describe('#FileCoordinator', () => {
  process.env.DynamoDBTableFiles = 'Files'
  const context = testContext
  const event = JSON.parse(JSON.stringify(eventMock))
  test('should handle scheduled event (with no events)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-204-NoContent.json', {assert: {type: 'json'}})
    scanMock.mockReturnValue(scanResponse)
    sendMock.mockResolvedValue({StatusCode: 202})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(sendMock).toHaveBeenCalledTimes(0)
  })
  test('should handle scheduled event (with 1 event)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-200-OK.json', {assert: {type: 'json'}})
    scanMock.mockReturnValue(scanResponse)
    sendMock.mockResolvedValue({StatusCode: 202})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(sendMock).toHaveBeenCalled()
  })
  describe('#AWSFailure', () => {
    test('AWS.DynamoDB.DocumentClient.scan', async () => {
      const message = 'AWS request failed'
      scanMock.mockReturnValue(undefined)
      await expect(handler(event, context)).rejects.toThrowError(message)
    })
  })
})
