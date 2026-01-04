import {beforeEach, describe, expect, test, vi} from 'vitest'

type ResultRow = {id?: string; fileId?: string; deviceId?: string}

// Mock db.select().from().where().limit() chain for single assertions
// and db.select().from().where() for batch assertions (no limit)
const mockWhere = vi.fn<() => Promise<ResultRow[]> | {limit: () => Promise<ResultRow[]>}>()
const mockFrom = vi.fn(() => ({where: mockWhere}))
const mockSelect = vi.fn(() => ({from: mockFrom}))
const mockDb = {select: mockSelect}

vi.mock('./../client', () => ({getDrizzleClient: vi.fn(async () => mockDb)}))

// Mock schema tables
vi.mock('./../schema', () => ({users: {id: 'id'}, files: {fileId: 'fileId'}, devices: {deviceId: 'deviceId'}}))

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({eq: vi.fn((col: unknown, val: unknown) => ({col, val})), inArray: vi.fn((col: unknown, vals: unknown[]) => ({col, vals}))}))

const {assertUserExists, assertFileExists, assertDeviceExists, assertUsersExist, assertFilesExist, ForeignKeyViolationError} = await import(
  './../fkEnforcement'
)

describe('FK Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ForeignKeyViolationError', () => {
    test('should create error with table, column, and value', () => {
      const error = new ForeignKeyViolationError('users', 'id', 'user-123')

      expect(error.name).toEqual('ForeignKeyViolationError')
      expect(error.table).toEqual('users')
      expect(error.column).toEqual('id')
      expect(error.value).toEqual('user-123')
      expect(error.message).toContain('users.id = user-123')
      expect(error.message).toContain('does not exist')
    })

    test('should be instanceof Error', () => {
      const error = new ForeignKeyViolationError('files', 'fileId', 'file-456')
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('assertUserExists', () => {
    test('should not throw when user exists', async () => {
      mockWhere.mockReturnValue({limit: () => Promise.resolve([{id: 'user-123'}])})

      await expect(assertUserExists('user-123')).resolves.toBeUndefined()
    })

    test('should throw ForeignKeyViolationError when user does not exist', async () => {
      mockWhere.mockReturnValue({limit: () => Promise.resolve([])})

      await expect(assertUserExists('nonexistent-user')).rejects.toThrow(ForeignKeyViolationError)
    })

    test('should include table and column in error message', async () => {
      mockWhere.mockReturnValue({limit: () => Promise.resolve([])})

      try {
        await assertUserExists('missing-user')
      } catch (error) {
        expect(error).toBeInstanceOf(ForeignKeyViolationError)
        expect((error as Error).message).toContain('users.id = missing-user')
      }
    })
  })

  describe('assertFileExists', () => {
    test('should not throw when file exists', async () => {
      mockWhere.mockReturnValue({limit: () => Promise.resolve([{fileId: 'file-123'}])})

      await expect(assertFileExists('file-123')).resolves.toBeUndefined()
    })

    test('should throw ForeignKeyViolationError when file does not exist', async () => {
      mockWhere.mockReturnValue({limit: () => Promise.resolve([])})

      await expect(assertFileExists('nonexistent-file')).rejects.toThrow(ForeignKeyViolationError)
    })
  })

  describe('assertDeviceExists', () => {
    test('should not throw when device exists', async () => {
      mockWhere.mockReturnValue({limit: () => Promise.resolve([{deviceId: 'device-123'}])})

      await expect(assertDeviceExists('device-123')).resolves.toBeUndefined()
    })

    test('should throw ForeignKeyViolationError when device does not exist', async () => {
      mockWhere.mockReturnValue({limit: () => Promise.resolve([])})

      await expect(assertDeviceExists('nonexistent-device')).rejects.toThrow(ForeignKeyViolationError)
    })
  })

  describe('assertUsersExist (batch)', () => {
    test('should not throw when all users exist', async () => {
      // Batch query - where returns result directly (no limit)
      mockWhere.mockReturnValue(Promise.resolve([{id: 'user-1'}, {id: 'user-2'}, {id: 'user-3'}]) as Promise<ResultRow[]>)

      await expect(assertUsersExist(['user-1', 'user-2', 'user-3'])).resolves.toBeUndefined()
    })

    test('should throw for first missing user', async () => {
      // Only user-1 found, user-2 missing
      mockWhere.mockReturnValue(Promise.resolve([{id: 'user-1'}]) as Promise<ResultRow[]>)

      await expect(assertUsersExist(['user-1', 'user-2'])).rejects.toThrow(ForeignKeyViolationError)
    })

    test('should return immediately for empty array', async () => {
      await expect(assertUsersExist([])).resolves.toBeUndefined()
      // Should not call the database at all
      expect(mockSelect).not.toHaveBeenCalled()
    })
  })

  describe('assertFilesExist (batch)', () => {
    test('should not throw when all files exist', async () => {
      mockWhere.mockReturnValue(Promise.resolve([{fileId: 'file-1'}, {fileId: 'file-2'}]) as Promise<ResultRow[]>)

      await expect(assertFilesExist(['file-1', 'file-2'])).resolves.toBeUndefined()
    })

    test('should throw for first missing file', async () => {
      // Only file-1 found
      mockWhere.mockReturnValue(Promise.resolve([{fileId: 'file-1'}]) as Promise<ResultRow[]>)

      await expect(assertFilesExist(['file-1', 'file-2', 'file-3'])).rejects.toThrow(ForeignKeyViolationError)
    })

    test('should return immediately for empty array', async () => {
      await expect(assertFilesExist([])).resolves.toBeUndefined()
      expect(mockSelect).not.toHaveBeenCalled()
    })
  })
})
