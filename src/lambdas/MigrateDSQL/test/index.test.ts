import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {createMockContext} from '#util/jest-setup'

// Mock fs module for reading migration files
const mockReaddirSync = jest.fn<() => string[]>()
const mockReadFileSync = jest.fn<(path: string) => string>()
jest.unstable_mockModule('fs', () => ({
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync
}))

// Mock path and url modules
jest.unstable_mockModule('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  dirname: jest.fn((path: string) => path.replace(/\/[^/]+$/, ''))
}))

jest.unstable_mockModule('url', () => ({fileURLToPath: jest.fn(() => '/lambda/index.js')}))

// Mock Drizzle client with proper chaining for execute
// postgres-js returns RowList which is directly iterable as an array
const mockExecute = jest.fn<() => Promise<Array<{version: string}>>>()
jest.unstable_mockModule('#lib/vendor/Drizzle/client', () => ({getDrizzleClient: jest.fn(async () => ({execute: mockExecute}))}))

// Mock drizzle-orm sql template
jest.unstable_mockModule('drizzle-orm', () => ({sql: {raw: jest.fn((s: string) => s)}}))

// Mock middleware - pass through the handler function
jest.unstable_mockModule('#lib/lambda/middleware/powertools',
  () => ({withPowertools: jest.fn(<T extends (...args: never[]) => unknown>(handler: T) => handler)}))

jest.unstable_mockModule('#lib/lambda/middleware/internal',
  () => ({wrapLambdaInvokeHandler: jest.fn(<T extends (...args: never[]) => unknown>(handler: T) => handler)}))

// Import handler after all mocks are set up
const {handler} = await import('./../src')

const context = createMockContext({functionName: 'MigrateDSQL'})

describe('MigrateDSQL Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
})
