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
    await handler(event, context)
    expect(invokeAsyncMock).toHaveBeenCalledTimes(0)
  })

  test('should handle scheduled event (with 1 pending download)', async () => {
    // Mock: first call (pending) returns 1 file, second call (scheduled) returns 0
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({data: [{fileId: 'pending-1', status: 'Pending'}]}).mockResolvedValueOnce({
      data: []
    })
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})

    await handler(event, context)

    expect(invokeAsyncMock).toHaveBeenCalledTimes(1)
  })

  test('should process scheduled retries from FileDownloads', async () => {
    // Mock: first call (pending) returns 0, second call (scheduled) returns 1
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({data: []}).mockResolvedValueOnce({
      data: [{fileId: 'scheduled-retry-1', status: 'Scheduled', retryAfter: Math.floor(Date.now() / 1000) - 100}]
    })
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})

    await handler(event, context)

    expect(invokeAsyncMock).toHaveBeenCalledTimes(1)
  })

  test('should process both pending downloads and scheduled retries', async () => {
    // Mock: first call (pending) returns 1, second call (scheduled) returns 1
    fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({data: [{fileId: 'pending-1', status: 'Pending'}]}).mockResolvedValueOnce({
      data: [{fileId: 'scheduled-1', status: 'Scheduled', retryAfter: Math.floor(Date.now() / 1000) - 100}]
    })
    invokeAsyncMock.mockResolvedValue({StatusCode: 202})

    await handler(event, context)

    expect(invokeAsyncMock).toHaveBeenCalledTimes(2)
  })

  describe('#PartialFailure', () => {
    test('should handle pending query failure gracefully and continue', async () => {
      // First call (pending) rejects - simulating failure
      // Second call (scheduled) succeeds with 1 file
      fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockRejectedValueOnce(new Error('DynamoDB error')).mockResolvedValueOnce({
        data: [{fileId: 'scheduled-1', status: 'Scheduled', retryAfter: Math.floor(Date.now() / 1000) - 100}]
      })
      invokeAsyncMock.mockResolvedValue({StatusCode: 202})

      // Handler should complete successfully (not throw)
      await handler(event, context)

      // Should still process the scheduled download despite pending query failure
      expect(invokeAsyncMock).toHaveBeenCalledTimes(1)
    })

    test('should handle scheduled query failure gracefully and continue', async () => {
      // First call (pending) succeeds with 1 file
      // Second call (scheduled) rejects - simulating failure
      fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockResolvedValueOnce({data: [{fileId: 'pending-1', status: 'Pending'}]}).mockRejectedValueOnce(
        new Error('DynamoDB error')
      )
      invokeAsyncMock.mockResolvedValue({StatusCode: 202})

      // Handler should complete successfully (not throw)
      await handler(event, context)

      // Should still process the pending download despite scheduled query failure
      expect(invokeAsyncMock).toHaveBeenCalledTimes(1)
    })

    test('should handle both queries failing gracefully', async () => {
      // Both queries reject
      fileDownloadsMock.mocks.query.byStatusRetryAfter!.go.mockRejectedValueOnce(new Error('DynamoDB error 1')).mockRejectedValueOnce(
        new Error('DynamoDB error 2')
      )

      // Handler should complete successfully (not throw)
      await handler(event, context)

      // No downloads to process when both queries fail
      expect(invokeAsyncMock).toHaveBeenCalledTimes(0)
    })
  })
})
