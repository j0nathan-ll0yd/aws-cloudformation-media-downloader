import {testContext} from '../../../util/jest-setup'
import {describe, expect, test, jest} from '@jest/globals'
const {default: eventMock} = await import('./fixtures/ScheduledEvent.json', {assert: {type: 'json'}})

const filesQueryGoMock = jest.fn<() => Promise<{data: unknown[]} | undefined>>()
const filesQueryWhereMock = jest.fn(() => ({
  where: filesQueryWhereMock,
  go: filesQueryGoMock
}))
const filesQueryByStatusMock = jest.fn(() => ({
  where: filesQueryWhereMock,
  go: filesQueryGoMock
}))
jest.unstable_mockModule('../../../entities/Files', () => ({
  Files: {
    query: {
      byStatus: filesQueryByStatusMock
    }
  }
}))
const invokeAsyncMock = jest.fn<() => Promise<{StatusCode: number}>>()
jest.unstable_mockModule('../../../lib/vendor/AWS/Lambda', () => ({
  invokeAsync: invokeAsyncMock
}))

const {handler} = await import('./../src')

describe('#FileCoordinator', () => {
  const context = testContext
  const event = JSON.parse(JSON.stringify(eventMock))
  test('should handle scheduled event (with no events)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-204-NoContent.json', {assert: {type: 'json'}})
    filesQueryGoMock.mockResolvedValue({data: scanResponse.Items || []})
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(0)
  })
  test('should handle scheduled event (with 1 event)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-200-OK.json', {assert: {type: 'json'}})
    filesQueryGoMock.mockResolvedValue({data: scanResponse.Items || []})
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalled()
  })
  describe('#AWSFailure', () => {
    test('ElectroDB Files.query', async () => {
      const message = 'AWS request failed'
      filesQueryGoMock.mockResolvedValue(undefined)
      await expect(handler(event, context)).rejects.toThrowError(message)
    })
  })
})
