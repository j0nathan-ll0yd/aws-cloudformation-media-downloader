import {describe, it, expect, jest, beforeEach} from '@jest/globals'

// Mock lambda-helpers before importing retry
jest.unstable_mockModule('../lambda-helpers', () => ({
  logDebug: jest.fn(),
  logError: jest.fn()
}))

const {retryUnprocessed, retryUnprocessedDelete} = await import('../retry')

describe('retryUnprocessed', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return data without retrying when no unprocessed items', async () => {
    const mockOperation = jest.fn<() => Promise<{data: string[]; unprocessed: unknown[]}>>().mockResolvedValue({
      data: ['item1', 'item2'],
      unprocessed: []
    })

    const result = await retryUnprocessed(mockOperation)

    expect(result.data).toEqual(['item1', 'item2'])
    expect(result.unprocessed).toEqual([])
    expect(mockOperation).toHaveBeenCalledTimes(1)
  })

  it('should retry when there are unprocessed items', async () => {
    const mockOperation = jest
      .fn<() => Promise<{data: string[]; unprocessed: unknown[]}>>()
      .mockResolvedValueOnce({data: ['item1'], unprocessed: [{key: 'failed1'}]})
      .mockResolvedValueOnce({data: ['item2'], unprocessed: []})

    const result = await retryUnprocessed(mockOperation, {initialDelayMs: 1})

    expect(result.data).toEqual(['item1', 'item2'])
    expect(result.unprocessed).toEqual([])
    expect(mockOperation).toHaveBeenCalledTimes(2)
  })

  it('should stop retrying after maxRetries', async () => {
    const mockOperation = jest.fn<() => Promise<{data: string[]; unprocessed: unknown[]}>>().mockResolvedValue({
      data: ['item1'],
      unprocessed: [{key: 'always-fails'}]
    })

    const result = await retryUnprocessed(mockOperation, {maxRetries: 2, initialDelayMs: 1})

    expect(result.unprocessed).toEqual([{key: 'always-fails'}])
    expect(mockOperation).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('should accumulate data across retries', async () => {
    const mockOperation = jest
      .fn<() => Promise<{data: string[]; unprocessed: unknown[]}>>()
      .mockResolvedValueOnce({data: ['a'], unprocessed: [{key: '1'}]})
      .mockResolvedValueOnce({data: ['b'], unprocessed: [{key: '2'}]})
      .mockResolvedValueOnce({data: ['c'], unprocessed: []})

    const result = await retryUnprocessed(mockOperation, {initialDelayMs: 1})

    expect(result.data).toEqual(['a', 'b', 'c'])
  })
})

describe('retryUnprocessedDelete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return without retrying when no unprocessed items', async () => {
    const mockOperation = jest.fn<() => Promise<{unprocessed: unknown[]}>>().mockResolvedValue({
      unprocessed: []
    })

    const result = await retryUnprocessedDelete(mockOperation)

    expect(result.unprocessed).toEqual([])
    expect(mockOperation).toHaveBeenCalledTimes(1)
  })

  it('should retry delete operations with unprocessed items', async () => {
    const mockOperation = jest
      .fn<() => Promise<{unprocessed: unknown[]}>>()
      .mockResolvedValueOnce({unprocessed: [{key: 'failed'}]})
      .mockResolvedValueOnce({unprocessed: []})

    const result = await retryUnprocessedDelete(mockOperation, {initialDelayMs: 1})

    expect(result.unprocessed).toEqual([])
    expect(mockOperation).toHaveBeenCalledTimes(2)
  })
})
