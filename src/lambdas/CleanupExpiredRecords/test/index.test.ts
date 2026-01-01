import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createMockContext} from '#util/vitest-setup'
import {createScheduledEvent} from '#test/helpers/event-factories'

// Mock Drizzle client with proper chaining
const mockReturning = vi.fn<() => Promise<Array<{fileId?: string; id?: string}>>>()
const mockWhere = vi.fn(() => ({returning: mockReturning}))
const mockDelete = vi.fn(() => ({where: mockWhere}))

vi.mock('#lib/vendor/Drizzle/client', () => ({getDrizzleClient: vi.fn(async () => ({delete: mockDelete}))}))

// Mock Drizzle schema - provide table references for delete()
// Updated to use Better Auth aligned schema (id instead of sessionId, verification instead of verificationTokens)
vi.mock('#lib/vendor/Drizzle/schema',
  () => ({
    fileDownloads: {fileId: 'fileId', status: 'status', updatedAt: 'updatedAt'},
    sessions: {id: 'id', expiresAt: 'expiresAt'},
    verification: {id: 'id', expiresAt: 'expiresAt'}
  }))

// Mock middleware
vi.mock('#lib/lambda/middleware/powertools', () => ({withPowertools: vi.fn(<T extends (...args: never[]) => unknown>(handler: T) => handler)}))

vi.mock('#lib/lambda/middleware/internal', () => ({wrapScheduledHandler: vi.fn(<T extends (...args: never[]) => unknown>(handler: T) => handler)}))

// Mock drizzle-orm operators
vi.mock('drizzle-orm',
  () => ({
    and: vi.fn((...args: unknown[]) => args),
    or: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((col: unknown, val: unknown) => ({col, val})),
    lt: vi.fn((col: unknown, val: unknown) => ({col, val}))
  }))

// Import handler after all mocks are set up
const {handler} = await import('./../src')

const context = createMockContext({functionName: 'CleanupExpiredRecords'})

describe('CleanupExpiredRecords Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReturning.mockResolvedValue([])
  })

  it('should successfully cleanup all record types', async () => {
    mockReturning.mockResolvedValueOnce([{fileId: 'file1'}]) // fileDownloads
      .mockResolvedValueOnce([{id: 'session1'}, {id: 'session2'}]) // sessions
      .mockResolvedValueOnce([]) // verification

    const result = await handler(createScheduledEvent(), context)

    expect(result).toEqual({fileDownloadsDeleted: 1, sessionsDeleted: 2, verificationTokensDeleted: 0, errors: []})
  })

  it('should continue cleanup when one type fails', async () => {
    mockReturning.mockRejectedValueOnce(new Error('Database connection failed')) // fileDownloads fails
      .mockResolvedValueOnce([{id: 'session1'}]) // sessions succeeds
      .mockResolvedValueOnce([{id: 'verification1'}]) // verification succeeds

    const result = await handler(createScheduledEvent(), context)

    expect(result.fileDownloadsDeleted).toBe(0)
    expect(result.sessionsDeleted).toBe(1)
    expect(result.verificationTokensDeleted).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('FileDownloads cleanup failed')
  })

  it('should collect all errors when multiple cleanups fail', async () => {
    mockReturning.mockRejectedValueOnce(new Error('Error 1')).mockRejectedValueOnce(new Error('Error 2')).mockRejectedValueOnce(new Error('Error 3'))

    const result = await handler(createScheduledEvent(), context)

    expect(result.errors).toHaveLength(3)
    expect(result.fileDownloadsDeleted).toBe(0)
    expect(result.sessionsDeleted).toBe(0)
    expect(result.verificationTokensDeleted).toBe(0)
  })

  it('should handle empty tables gracefully (no records to delete)', async () => {
    // All tables return empty arrays - nothing to cleanup
    mockReturning.mockResolvedValueOnce([]) // fileDownloads
      .mockResolvedValueOnce([]) // sessions
      .mockResolvedValueOnce([]) // verification

    const result = await handler(createScheduledEvent(), context)

    expect(result).toEqual({fileDownloadsDeleted: 0, sessionsDeleted: 0, verificationTokensDeleted: 0, errors: []})
    // Should still call delete for each table
    expect(mockDelete).toHaveBeenCalledTimes(3)
  })

  it('should handle large batch deletions correctly', async () => {
    // Simulate 100 expired file downloads
    const manyFileDownloads = Array.from({length: 100}, (_, i) => ({fileId: `file-${i}`}))
    const manySessions = Array.from({length: 50}, (_, i) => ({id: `session-${i}`}))

    mockReturning.mockResolvedValueOnce(manyFileDownloads).mockResolvedValueOnce(manySessions).mockResolvedValueOnce([])

    const result = await handler(createScheduledEvent(), context)

    expect(result.fileDownloadsDeleted).toBe(100)
    expect(result.sessionsDeleted).toBe(50)
    expect(result.verificationTokensDeleted).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should call delete operations in correct order', async () => {
    mockReturning.mockResolvedValue([])

    await handler(createScheduledEvent(), context)

    // Verify delete was called 3 times (once per table)
    expect(mockDelete).toHaveBeenCalledTimes(3)
    // Verify where was called for each delete
    expect(mockWhere).toHaveBeenCalledTimes(3)
    // Verify returning was called to get deleted record IDs
    expect(mockReturning).toHaveBeenCalledTimes(3)
  })

  it('should handle non-Error objects in catch blocks', async () => {
    // Some libraries throw strings or other non-Error objects
    mockReturning.mockRejectedValueOnce('String error').mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const result = await handler(createScheduledEvent(), context)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('String error')
  })

  describe('#EdgeCases', () => {
    it('should handle database timeout during cleanup', async () => {
      const timeoutError = new Error('Query timeout after 30000ms')
      Object.assign(timeoutError, {code: 'ETIMEDOUT'})
      mockReturning.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await handler(createScheduledEvent(), context)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('FileDownloads cleanup failed')
    })

    it('should handle transaction rollback error', async () => {
      const rollbackError = new Error('Transaction aborted: constraint violation')
      mockReturning.mockRejectedValueOnce(rollbackError).mockResolvedValueOnce([{id: 's1'}]).mockResolvedValueOnce([])

      const result = await handler(createScheduledEvent(), context)

      expect(result.fileDownloadsDeleted).toBe(0)
      expect(result.sessionsDeleted).toBe(1)
      expect(result.errors).toHaveLength(1)
    })

    it('should correctly count deleted records from each table type', async () => {
      // Specific counts for each table type
      const fileDownloads = [{fileId: 'f1'}, {fileId: 'f2'}, {fileId: 'f3'}]
      const sessions = [{id: 's1'}, {id: 's2'}]
      const verifications = [{id: 'v1'}]

      mockReturning.mockResolvedValueOnce(fileDownloads).mockResolvedValueOnce(sessions).mockResolvedValueOnce(verifications)

      const result = await handler(createScheduledEvent(), context)

      expect(result.fileDownloadsDeleted).toBe(3)
      expect(result.sessionsDeleted).toBe(2)
      expect(result.verificationTokensDeleted).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle null/undefined return from delete operations', async () => {
      // Edge case where returning() might return undefined or null
      mockReturning.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await handler(createScheduledEvent(), context)

      expect(result.fileDownloadsDeleted).toBe(0)
      expect(result.sessionsDeleted).toBe(0)
      expect(result.verificationTokensDeleted).toBe(0)
      expect(result.errors).toHaveLength(0)
    })
  })
})
