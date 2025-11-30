import {testContext} from '#util/jest-setup'
import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
const {default: eventMock} = await import('./fixtures/ScheduledEvent.json', {assert: {type: 'json'}})

// Mock Files entity (for pending downloads from WebhookFeedly)
const filesMock = createElectroDBEntityMock({queryIndexes: ['byStatus']})
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))

// Mock FileDownloads entity (for scheduled retries)
const fileDownloadsMock = createElectroDBEntityMock({queryIndexes: ['byStatusRetryAfter']})
jest.unstable_mockModule('#entities/FileDownloads', () => ({FileDownloads: fileDownloadsMock.entity}))

const invokeAsyncMock = jest.fn<() => Promise<{StatusCode: number}>>()
jest.unstable_mockModule('#lib/vendor/AWS/Lambda', () => ({invokeAsync: invokeAsyncMock}))

const {handler} = await import('./../src')

describe('#FileCoordinator', () => {
  const context = testContext
  const event = JSON.parse(JSON.stringify(eventMock))

  beforeEach(() => {
    jest.clearAllMocks()
    // Default: no scheduled downloads
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValue({data: []})
  })

  test('should handle scheduled event (with no events)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-204-NoContent.json', {assert: {type: 'json'}})
    filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: scanResponse.Items || []})
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(0)
  })

  test('should handle scheduled event (with 1 pending file)', async () => {
    const {default: scanResponse} = await import('./fixtures/scan-200-OK.json', {assert: {type: 'json'}})
    filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: scanResponse.Items || []})
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalled()
  })

  test('should process scheduled retries from FileDownloads', async () => {
    // No pending files
    filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: []})
    // One scheduled retry ready
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValue({
      data: [{fileId: 'scheduled-retry-1', status: 'scheduled', retryAfter: Math.floor(Date.now() / 1000) - 100}]
    })
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(1)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.scheduled).toEqual(1)
  })

  test('should process both pending files and scheduled retries', async () => {
    // One pending file
    filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: [{fileId: 'pending-1', status: 'PendingDownload'}]})
    // One scheduled retry
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValue({
      data: [{fileId: 'scheduled-1', status: 'scheduled', retryAfter: Math.floor(Date.now() / 1000) - 100}]
    })
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(2)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.pending).toEqual(1)
    expect(parsedBody.body.scheduled).toEqual(1)
  })

  describe('#AWSFailure', () => {
    test('should throw error when file query fails', async () => {
      const message = 'AWS request failed'
      filesMock.mocks.query.byStatus!.go.mockResolvedValue(undefined)
      await expect(handler(event, context)).rejects.toThrowError(message)
    })

    test('should throw error when FileDownloads query fails', async () => {
      const message = 'AWS request failed'
      filesMock.mocks.query.byStatus!.go.mockResolvedValue({data: []})
      fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValue(undefined)
      await expect(handler(event, context)).rejects.toThrowError(message)
    })
  })
})
