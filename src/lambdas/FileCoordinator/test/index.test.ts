import {testContext} from '#util/jest-setup'
import {describe, expect, jest, test} from '@jest/globals'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
const {default: eventMock} = await import('./fixtures/ScheduledEvent.json', {assert: {type: 'json'}})

const filesMock = createElectroDBEntityMock({queryIndexes: ['byStatus']})
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

const invokeAsyncMock = jest.fn<() => Promise<{StatusCode: number}>>()
jest.unstable_mockModule('#lib/vendor/AWS/Lambda', () => ({invokeAsync: invokeAsyncMock}))

const {handler} = await import('./../src')

describe('#FileCoordinator', () => {
  const context = testContext
  const event = JSON.parse(JSON.stringify(eventMock))
  test('should handle scheduled event (with no events)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-204-NoContent.json', {assert: {type: 'json'}})
    filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: scanResponse.Items || []})
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(0)
  })
  test('should handle scheduled event (with 1 event)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-200-OK.json', {assert: {type: 'json'}})
    filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: scanResponse.Items || []})
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalled()
  })
  describe('#AWSFailure', () => {
    test('should throw error when file query fails', async () => {
      const message = 'AWS request failed'
      filesMock.mocks.query.byStatus!.go.mockResolvedValue(undefined)
      await expect(handler(event, context)).rejects.toThrowError(message)
    })
  })
})
