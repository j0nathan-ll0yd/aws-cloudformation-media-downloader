import {testContext} from '#util/jest-setup'
import {beforeEach, describe, expect, jest, test} from '@jest/globals'
import {DownloadStatus} from '#types/enums'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'
const {default: eventMock} = await import('./fixtures/ScheduledEvent.json', {assert: {type: 'json'}})

// Mock FileDownloads entity (only entity used by FileCoordinator now)
// FileCoordinator queries:
// - status='pending' for new downloads
// - status='scheduled' for retries
const fileDownloadsMock = createElectroDBEntityMock({queryIndexes: ['byStatusRetryAfter']})
jest.unstable_mockModule('#entities/FileDownloads', () => ({
  FileDownloads: fileDownloadsMock.entity,
  DownloadStatus // Re-export the real enum
}))

const invokeAsyncMock = jest.fn<() => Promise<{StatusCode: number}>>()
jest.unstable_mockModule('#lib/vendor/AWS/Lambda', () => ({invokeAsync: invokeAsyncMock}))

const {handler} = await import('./../src')

describe('#FileCoordinator', () => {
  const context = testContext
  const event = JSON.parse(JSON.stringify(eventMock))

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset mock to return empty arrays by default
    // Note: getPendingFileIds and getScheduledFileIds both use byStatusRetryAfter
    // First call = pending, Second call = scheduled
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValue({data: []})
  })

  test('should handle scheduled event (with no downloads)', async () => {
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})
    const output = await handler(event, context)
    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(0)
  })

  test('should handle scheduled event (with 1 pending download)', async () => {
    // Mock: first call (pending) returns 1 file, second call (scheduled) returns 0
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go
      .mockResolvedValueOnce({data: [{fileId: 'pending-1', status: 'pending'}]})
      .mockResolvedValueOnce({data: []})
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(1)
  })

  test('should process scheduled retries from FileDownloads', async () => {
    // Mock: first call (pending) returns 0, second call (scheduled) returns 1
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go
      .mockResolvedValueOnce({data: []})
      .mockResolvedValueOnce({data: [{fileId: 'scheduled-retry-1', status: 'scheduled', retryAfter: Math.floor(Date.now() / 1000) - 100}]})
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(1)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.scheduled).toEqual(1)
  })

  test('should process both pending downloads and scheduled retries', async () => {
    // Mock: first call (pending) returns 1, second call (scheduled) returns 1
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go
      .mockResolvedValueOnce({data: [{fileId: 'pending-1', status: 'pending'}]})
      .mockResolvedValueOnce({data: [{fileId: 'scheduled-1', status: 'scheduled', retryAfter: Math.floor(Date.now() / 1000) - 100}]})
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})

    const output = await handler(event, context)

    expect(output.statusCode).toEqual(200)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(2)
    const parsedBody = JSON.parse(output.body)
    expect(parsedBody.body.pending).toEqual(1)
    expect(parsedBody.body.scheduled).toEqual(1)
  })

  describe('#AWSFailure', () => {
    test('should throw error when pending query fails', async () => {
      const message = 'AWS request failed'
      // First call (pending) returns undefined - simulating failure
      fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce(undefined)
      await expect(handler(event, context)).rejects.toThrow(message)
    })

    test('should throw error when scheduled query fails', async () => {
      const message = 'AWS request failed'
      // First call (pending) succeeds, second call (scheduled) fails
      fileDownloadsMock.mocks.query.byStatusRetryAfter!.go
        .mockResolvedValueOnce({data: []})
        .mockResolvedValueOnce(undefined)
      await expect(handler(event, context)).rejects.toThrow(message)
    })
  })
})
