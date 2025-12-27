import {beforeEach, describe, expect, it, vi} from 'vitest'
import {retryUnprocessed, retryUnprocessedDelete} from '../retry'

type RetryOpFn = () => Promise<{data: string[]; unprocessed: unknown[]}>
type DeleteOpFn = () => Promise<{unprocessed: unknown[]}>

describe('retryUnprocessed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return data without retrying when no unprocessed items', async () => {
    const mockOperation = vi.fn<RetryOpFn>()
    mockOperation.mockResolvedValue({data: ['item1', 'item2'], unprocessed: []})

    const result = await retryUnprocessed(mockOperation)

    expect(result.data).toEqual(['item1', 'item2'])
    expect(result.unprocessed).toEqual([])
    expect(mockOperation).toHaveBeenCalledTimes(1)
  })

  it('should retry when there are unprocessed items', async () => {
    const mockOperation = vi.fn<RetryOpFn>()
    mockOperation.mockResolvedValueOnce({data: ['item1'], unprocessed: [{key: 'failed1'}]})
    mockOperation.mockResolvedValueOnce({data: ['item2'], unprocessed: []})

    const result = await retryUnprocessed(mockOperation, {initialDelayMs: 1})

    expect(result.data).toEqual(['item1', 'item2'])
    expect(result.unprocessed).toEqual([])
    expect(mockOperation).toHaveBeenCalledTimes(2)
  })

  it('should stop retrying after maxRetries', async () => {
    const mockOperation = vi.fn<RetryOpFn>()
    mockOperation.mockResolvedValue({data: ['item1'], unprocessed: [{key: 'always-fails'}]})

    const result = await retryUnprocessed(mockOperation, {maxRetries: 2, initialDelayMs: 1})

    expect(result.unprocessed).toEqual([{key: 'always-fails'}])
    expect(mockOperation).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })

  it('should accumulate data across retries', async () => {
    const mockOperation = vi.fn<RetryOpFn>()
    mockOperation.mockResolvedValueOnce({data: ['a'], unprocessed: [{key: '1'}]})
    mockOperation.mockResolvedValueOnce({data: ['b'], unprocessed: [{key: '2'}]})
    mockOperation.mockResolvedValueOnce({data: ['c'], unprocessed: []})

    const result = await retryUnprocessed(mockOperation, {initialDelayMs: 1})

    expect(result.data).toEqual(['a', 'b', 'c'])
  })
})

describe('retryUnprocessedDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return without retrying when no unprocessed items', async () => {
    const mockOperation = vi.fn<DeleteOpFn>()
    mockOperation.mockResolvedValue({unprocessed: []})

    const result = await retryUnprocessedDelete(mockOperation)

    expect(result.unprocessed).toEqual([])
    expect(mockOperation).toHaveBeenCalledTimes(1)
  })

  it('should retry delete operations with unprocessed items', async () => {
    const mockOperation = vi.fn<DeleteOpFn>()
    mockOperation.mockResolvedValueOnce({unprocessed: [{key: 'failed'}]})
    mockOperation.mockResolvedValueOnce({unprocessed: []})

    const result = await retryUnprocessedDelete(mockOperation, {initialDelayMs: 1})

    expect(result.unprocessed).toEqual([])
    expect(mockOperation).toHaveBeenCalledTimes(2)
  })
})
