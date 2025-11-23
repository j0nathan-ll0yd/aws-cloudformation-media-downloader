import {jest} from '@jest/globals'

/**
 * ElectroDB Entity Mock Structure
 * Provides type-safe mocks for all common ElectroDB operations
 */
interface ElectroDBEntityMock<TData> {
  /**
   * The entity object to pass to jest.unstable_mockModule
   * @example
   * const filesMock = createElectroDBEntityMock<DynamoDBFile>()
   * jest.unstable_mockModule('path/to/Files', () => ({ Files: filesMock.entity }))
   */
  entity: {
    get: jest.Mock
    scan: {
      go: jest.Mock
      where: jest.Mock
    }
    query: {
      byUser?: jest.Mock
      byFile?: jest.Mock
      byDevice?: jest.Mock
      byStatus?: jest.Mock
      byKey?: jest.Mock
    }
    create: jest.Mock
    upsert: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }
  /**
   * Individual mock functions for assertions and setup
   * @example
   * // Single get
   * filesMock.mocks.get.mockResolvedValue({data: {fileId: '123', ...}})
   * // Batch get
   * filesMock.mocks.get.mockResolvedValue({data: [{fileId: '123'}, ...], unprocessed: []})
   * expect(filesMock.mocks.create).toHaveBeenCalledTimes(1)
   */
  mocks: {
    get: jest.Mock<() => Promise<{data: TData | TData[] | undefined; unprocessed?: unknown[]} | undefined>>
    scan: {
      go: jest.Mock<() => Promise<{data: TData[]} | undefined>>
      where: jest.Mock
    }
    query: {
      byUser?: {
        go: jest.Mock<() => Promise<{data: TData[]} | undefined>>
        where: jest.Mock
      }
      byFile?: {
        go: jest.Mock<() => Promise<{data: TData[]} | undefined>>
        where: jest.Mock
      }
      byDevice?: {
        go: jest.Mock<() => Promise<{data: TData[]} | undefined>>
        where: jest.Mock
      }
      byStatus?: {
        go: jest.Mock<() => Promise<{data: TData[]} | undefined>>
        where: jest.Mock
      }
      byKey?: {
        go: jest.Mock<() => Promise<{data: TData[]} | undefined>>
        where: jest.Mock
      }
    }
    create: jest.Mock<() => Promise<{data: TData}>>
    upsert: {
      go: jest.Mock<() => Promise<{data: TData}>>
    }
    update: {
      go: jest.Mock<() => Promise<{data: TData} | undefined>>
      set: jest.Mock
      add: jest.Mock
      delete: jest.Mock
    }
    delete: jest.Mock<() => Promise<{unprocessed?: unknown[]} | void>>
  }
}

/**
 * Creates a complete mock for an ElectroDB entity
 *
 * Supports all common ElectroDB operations:
 * - get: Entity.get({key}).go()
 * - scan: Entity.scan().go() or Entity.scan().where(...).go()
 * - query: Entity.query.byIndex({key}).go() or Entity.query.byIndex({key}).where(...).go()
 * - create: Entity.create(item).go()
 * - update: Entity.update({key}).set/add/delete({...}).go()
 * - delete: Entity.delete({key}).go()
 *
 * @template TData The type of data this entity returns
 * @param options Configuration options
 * @param options.queryIndexes Array of index names to create query mocks for (e.g., ['byUser', 'byFile'])
 * @returns Object with entity mock and individual mock functions
 *
 * @example
 * // Create mock with query support
 * const filesMock = createElectroDBEntityMock<DynamoDBFile>({queryIndexes: ['byKey', 'byStatus']})
 *
 * // Use in jest.unstable_mockModule
 * jest.unstable_mockModule('../entities/Files', () => ({
 *   Files: filesMock.entity
 * }))
 *
 * // Setup mock behavior
 * filesMock.mocks.query.byKey!.go.mockResolvedValue({data: [{fileId: '123', status: 'Downloaded'}]})
 *
 * // Assert in tests
 * expect(filesMock.mocks.query.byKey!.go).toHaveBeenCalledTimes(1)
 */
export function createElectroDBEntityMock<TData = unknown>(options?: {
  queryIndexes?: Array<'byUser' | 'byFile' | 'byDevice' | 'byStatus' | 'byKey'>
}): ElectroDBEntityMock<TData> {
  // Get operation: Entity.get({key}).go() or Entity.get([...]).go()
  // Supports both single and batch operations
  const getMock = jest.fn<() => Promise<{data: TData | TData[] | undefined; unprocessed?: unknown[]} | undefined>>()
  const get = jest.fn(() => ({go: getMock}))

  // Scan operation: Entity.scan().go() or Entity.scan().where(...).go()
  const scanGoMock = jest.fn<() => Promise<{data: TData[]} | undefined>>()
  const scanWhereMock = jest.fn(() => ({go: scanGoMock}))
  const scan = {
    go: scanGoMock,
    where: scanWhereMock
  }

  // Query operations: Entity.query.byIndex({key}).go() or Entity.query.byIndex({key}).where(...).go()
  const queryEntity: any = {}
  const queryMocks: any = {}

  if (options?.queryIndexes) {
    for (const indexName of options.queryIndexes) {
      const queryGoMock = jest.fn<() => Promise<{data: TData[]} | undefined>>()
      const queryWhereMock = jest.fn(() => ({
        where: queryWhereMock,
        go: queryGoMock
      }))
      const queryIndexMock = jest.fn(() => ({
        where: queryWhereMock,
        go: queryGoMock
      }))

      queryEntity[indexName] = queryIndexMock
      queryMocks[indexName] = {
        go: queryGoMock,
        where: queryWhereMock
      }
    }
  }

  // Create operation: Entity.create(item).go()
  const createGoMock = jest.fn<() => Promise<{data: TData}>>()
  const create = jest.fn(() => ({go: createGoMock}))

  // Upsert operation: Entity.upsert(item).go()
  const upsertGoMock = jest.fn<() => Promise<{data: TData}>>()
  const upsert = jest.fn(() => ({go: upsertGoMock}))

  // Update operation: Entity.update({key}).set/add/delete({...}).go()
  const updateGoMock = jest.fn<() => Promise<{data: TData} | undefined>>()
  const updateSetMock = jest.fn(() => ({go: updateGoMock}))
  const updateAddMock = jest.fn(() => ({go: updateGoMock}))
  const updateDeleteMock = jest.fn(() => ({go: updateGoMock}))
  const update = jest.fn(() => ({
    set: updateSetMock,
    add: updateAddMock,
    delete: updateDeleteMock,
    go: updateGoMock
  }))

  // Delete operation: Entity.delete({key}).go() or Entity.delete([...]).go()
  // Supports both single (returns void) and batch (returns {unprocessed}) operations
  const deleteGoMock = jest.fn<() => Promise<{unprocessed?: unknown[]} | void>>()
  const deleteOp = jest.fn(() => ({go: deleteGoMock}))

  return {
    entity: {
      get,
      scan,
      query: queryEntity,
      create,
      upsert,
      update,
      delete: deleteOp
    },
    mocks: {
      get: getMock,
      scan: {
        go: scanGoMock,
        where: scanWhereMock
      },
      query: queryMocks,
      create: createGoMock,
      upsert: {
        go: upsertGoMock
      },
      update: {
        go: updateGoMock,
        set: updateSetMock,
        add: updateAddMock,
        delete: updateDeleteMock
      },
      delete: deleteGoMock
    }
  }
}
