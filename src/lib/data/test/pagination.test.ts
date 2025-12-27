import {beforeEach, describe, expect, it, vi} from 'vitest'
import {scanAllPages} from '../pagination'

type ScanFn<T> = (cursor?: string) => Promise<{data: T[]; cursor: string | null}>

describe('scanAllPages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return all items from a single page', async () => {
    const mockScan = vi.fn<ScanFn<string>>()
    mockScan.mockResolvedValue({data: ['item1', 'item2', 'item3'], cursor: null})

    const result = await scanAllPages(mockScan)

    expect(result).toEqual(['item1', 'item2', 'item3'])
    expect(mockScan).toHaveBeenCalledTimes(1)
    expect(mockScan).toHaveBeenCalledWith(undefined)
  })

  it('should paginate through multiple pages', async () => {
    const mockScan = vi.fn<ScanFn<string>>()
    mockScan.mockResolvedValueOnce({data: ['page1-item1', 'page1-item2'], cursor: 'cursor1'})
    mockScan.mockResolvedValueOnce({data: ['page2-item1', 'page2-item2'], cursor: 'cursor2'})
    mockScan.mockResolvedValueOnce({data: ['page3-item1'], cursor: null})

    const result = await scanAllPages(mockScan)

    expect(result).toEqual(['page1-item1', 'page1-item2', 'page2-item1', 'page2-item2', 'page3-item1'])
    expect(mockScan).toHaveBeenCalledTimes(3)
    expect(mockScan).toHaveBeenNthCalledWith(1, undefined)
    expect(mockScan).toHaveBeenNthCalledWith(2, 'cursor1')
    expect(mockScan).toHaveBeenNthCalledWith(3, 'cursor2')
  })

  it('should return empty array when no data', async () => {
    const mockScan = vi.fn<ScanFn<string>>()
    mockScan.mockResolvedValue({data: [], cursor: null})

    const result = await scanAllPages(mockScan)

    expect(result).toEqual([])
    expect(mockScan).toHaveBeenCalledTimes(1)
  })

  it('should work with complex objects', async () => {
    interface Device {
      deviceId: string
      token: string
    }

    const mockScan = vi.fn<ScanFn<Device>>()
    mockScan.mockResolvedValueOnce({data: [{deviceId: '1', token: 'token1'}, {deviceId: '2', token: 'token2'}], cursor: 'next'})
    mockScan.mockResolvedValueOnce({data: [{deviceId: '3', token: 'token3'}], cursor: null})

    const result = await scanAllPages(mockScan)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({deviceId: '1', token: 'token1'})
    expect(result[2]).toEqual({deviceId: '3', token: 'token3'})
  })
})
