import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createMockContext} from '#util/vitest-setup'

// Mock fs module for reading migration files
const mockReaddirSync = vi.fn<() => string[]>()
const mockReadFileSync = vi.fn<(path: string) => string>()
vi.mock('fs', () => ({readdirSync: mockReaddirSync, readFileSync: mockReadFileSync}))

// Mock path and url modules
vi.mock('path', () => ({join: vi.fn((...args: string[]) => args.join('/')), dirname: vi.fn((path: string) => path.replace(/\/[^/]+$/, ''))}))

vi.mock('url', () => ({fileURLToPath: vi.fn(() => '/lambda/index.js')}))

// Mock Drizzle client with proper chaining for execute
// postgres-js returns RowList which is directly iterable as an array
const mockExecute = vi.fn<() => Promise<Array<{version: string}>>>()
vi.mock('#lib/vendor/Drizzle/client', () => ({getDrizzleClient: vi.fn(async () => ({execute: mockExecute}))}))

// Mock drizzle-orm sql template
vi.mock('drizzle-orm', () => ({sql: {raw: vi.fn((s: string) => s)}}))

// Mock middleware - pass through the handler function
vi.mock('#lib/lambda/middleware/powertools', () => ({withPowertools: vi.fn(<T extends (...args: never[]) => unknown>(handler: T) => handler)}))

vi.mock('#lib/lambda/middleware/internal', () => ({wrapLambdaInvokeHandler: vi.fn(<T extends (...args: never[]) => unknown>(handler: T) => handler)}))

// Import handler after all mocks are set up
const {handler} = await import('./../src')

const context = createMockContext({functionName: 'MigrateDSQL'})

describe('MigrateDSQL Lambda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: migrations directory exists with two files
    mockReaddirSync.mockReturnValue(['0001_initial_schema.sql', '0002_create_indexes.sql'])
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('0001')) {
        return '-- Migration 0001\nCREATE TABLE IF NOT EXISTS users (id TEXT);'
      }
      if (path.includes('0002')) {
        return '-- Migration 0002\nCREATE INDEX ASYNC IF NOT EXISTS users_idx ON users(id);'
      }
      return ''
    })
    // Default: no migrations applied yet (empty array)
    mockExecute.mockResolvedValue([])
  })

  it('should apply all migrations when none are applied', async () => {
    const result = await handler({source: 'terraform-deploy'}, context)

    expect(result.applied).toEqual(['0001', '0002'])
    expect(result.skipped).toEqual([])
    expect(result.errors).toEqual([])
    // 4 calls: create table, select applied, apply 0001, record 0001, apply 0002, record 0002
    expect(mockExecute).toHaveBeenCalledTimes(6)
  })

  it('should skip already applied migrations', async () => {
    // First call returns empty (for create table), second returns applied migrations
    mockExecute.mockResolvedValueOnce([]) // CREATE TABLE schema_migrations
      .mockResolvedValueOnce([{version: '0001'}]) // SELECT applied
      .mockResolvedValue([]) // Remaining operations

    const result = await handler({source: 'terraform-deploy'}, context)

    expect(result.applied).toEqual(['0002'])
    expect(result.skipped).toEqual(['0001'])
    expect(result.errors).toEqual([])
  })

  it('should skip all migrations when all are applied', async () => {
    mockExecute.mockResolvedValueOnce([]) // CREATE TABLE
      .mockResolvedValueOnce([{version: '0001'}, {version: '0002'}]) // SELECT applied

    const result = await handler({source: 'terraform-deploy'}, context)

    expect(result.applied).toEqual([])
    expect(result.skipped).toEqual(['0001', '0002'])
    expect(result.errors).toEqual([])
  })

  it('should stop on first migration error', async () => {
    mockExecute.mockResolvedValueOnce([]) // CREATE TABLE
      .mockResolvedValueOnce([]) // SELECT applied (none)
      .mockRejectedValueOnce(new Error('SQL syntax error')) // Apply 0001 fails

    const result = await handler({source: 'terraform-deploy'}, context)

    expect(result.applied).toEqual([])
    expect(result.skipped).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('0001')
    expect(result.errors[0]).toContain('SQL syntax error')
  })

  it('should handle empty migrations directory', async () => {
    mockReaddirSync.mockReturnValue([])

    const result = await handler({source: 'terraform-deploy'}, context)

    expect(result.applied).toEqual([])
    expect(result.skipped).toEqual([])
    expect(result.errors).toEqual([])
  })

  it('should throw on invalid migration filename format', async () => {
    mockReaddirSync.mockReturnValue(['invalid-filename.sql'])
    mockReadFileSync.mockReturnValue('-- Invalid migration')

    await expect(handler({source: 'terraform-deploy'}, context)).rejects.toThrow('Invalid migration filename format')
  })

  it('should handle migrations directory not found', async () => {
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    await expect(handler({source: 'terraform-deploy'}, context)).rejects.toThrow('Failed to read migrations directory')
  })

  describe('#EdgeCases', () => {
    it('should handle database connection timeout', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Connection timeout after 30000ms'))

      await expect(handler({source: 'terraform-deploy'}, context)).rejects.toThrow('Connection timeout')
    })

    it('should filter out non-SQL files from migrations directory', async () => {
      mockReaddirSync.mockReturnValue(['0001_initial.sql', 'README.md', '.gitkeep', '0002_indexes.sql'])
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('0001')) {
          return 'CREATE TABLE test (id TEXT);'
        }
        if (path.includes('0002')) {
          return 'CREATE INDEX test_idx ON test(id);'
        }
        return ''
      })
      mockExecute.mockResolvedValue([])

      const result = await handler({source: 'terraform-deploy'}, context)

      // Should only process .sql files
      expect(result.applied).toEqual(['0001', '0002'])
      expect(result.skipped).toEqual([])
    })

    it('should handle concurrent migration attempts (schema_migrations table exists)', async () => {
      // First call succeeds (table already exists, no error)
      // Second call returns existing migrations
      mockExecute.mockResolvedValueOnce([]) // CREATE TABLE IF NOT EXISTS succeeds
        .mockResolvedValueOnce([{version: '0001'}, {version: '0002'}]) // All already applied

      const result = await handler({source: 'terraform-deploy'}, context)

      expect(result.applied).toEqual([])
      expect(result.skipped).toEqual(['0001', '0002'])
    })

    it('should handle recording migration version failure', async () => {
      mockExecute.mockResolvedValueOnce([]) // CREATE TABLE
        .mockResolvedValueOnce([]) // SELECT applied
        .mockResolvedValueOnce([]) // Apply migration 0001 succeeds
        .mockRejectedValueOnce(new Error('Failed to insert migration record')) // Recording fails

      const result = await handler({source: 'terraform-deploy'}, context)

      // Should report error for recording failure
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Failed to insert')
    })

    it('should process migrations in version order', async () => {
      // Files returned out of order
      mockReaddirSync.mockReturnValue(['0003_third.sql', '0001_first.sql', '0002_second.sql'])
      mockReadFileSync.mockReturnValue('-- Migration')
      mockExecute.mockResolvedValue([])

      const result = await handler({source: 'terraform-deploy'}, context)

      // Should be applied in sorted order
      expect(result.applied).toEqual(['0001', '0002', '0003'])
    })
  })
})
