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
const startExecutionMock = jest.fn()
jest.unstable_mockModule('../../../lib/vendor/AWS/StepFunctions', () => ({
  startExecution: startExecutionMock
}))

const {handler} = await import('./../src')

describe('#FileCoordinator', () => {
  process.env.DynamoDBTableFiles = 'Files'
  const context = testContext
  const event = eventMock
  test('should handle scheduled event (with no events)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-204-NoContent.json', {assert: {type: 'json'}})
    const {default: startExecutionResponse} = await import('./fixtures/startExecution-200-OK.json', {assert: {type: 'json'}})
    scanMock.mockReturnValue(scanResponse)
    startExecutionMock.mockReturnValue(startExecutionResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(startExecutionMock).toHaveBeenCalledTimes(0)
  })
  test('should handle scheduled event (with 1 event)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-200-OK.json', {assert: {type: 'json'}})
    const {default: startExecutionResponse} = await import('./fixtures/startExecution-200-OK.json', {assert: {type: 'json'}})
    scanMock.mockReturnValue(scanResponse)
    startExecutionMock.mockReturnValue(startExecutionResponse)
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(startExecutionMock).toHaveBeenCalled()
  })
  describe('#AWSFailure', () => {
    test('AWS.DynamoDB.DocumentClient.scan', async () => {
      const message = 'AWS request failed'
      scanMock.mockReturnValue(undefined)
      await expect(handler(event, context)).rejects.toThrowError(message)
    })
  })
})
