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
    create: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }
  /**
   * Individual mock functions for assertions and setup
   * @example
   * filesMock.mocks.get.mockResolvedValue({data: {fileId: '123', ...}})
   * expect(filesMock.mocks.create).toHaveBeenCalledTimes(1)
   */
  mocks: {
    get: jest.Mock<() => Promise<{data: TData | undefined} | undefined>>
    scan: {
      go: jest.Mock<() => Promise<{data: TData[]} | undefined>>
      where: jest.Mock
    }
    create: jest.Mock<() => Promise<{data: TData}>>
    update: {
      go: jest.Mock<() => Promise<{data: TData} | undefined>>
      set: jest.Mock
      add: jest.Mock
      delete: jest.Mock
    }
    delete: jest.Mock<() => Promise<void>>
  }
}

/**
 * Creates a complete mock for an ElectroDB entity
 *
 * Supports all common ElectroDB operations:
 * - get: Entity.get({key}).go()
 * - scan: Entity.scan().go() or Entity.scan().where(...).go()
 * - create: Entity.create(item).go()
 * - update: Entity.update({key}).set/add/delete({...}).go()
 * - delete: Entity.delete({key}).go()
 *
 * @template TData The type of data this entity returns
 * @returns Object with entity mock and individual mock functions
 *
 * @example
 * // Create mock
 * const filesMock = createElectroDBEntityMock<DynamoDBFile>()
 *
 * // Use in jest.unstable_mockModule
 * jest.unstable_mockModule('../entities/Files', () => ({
 *   Files: filesMock.entity
 * }))
 *
 * // Setup mock behavior
 * filesMock.mocks.get.mockResolvedValue({data: {fileId: '123', status: 'Downloaded'}})
 *
 * // Assert in tests
 * expect(filesMock.mocks.get).toHaveBeenCalledTimes(1)
 */
export function createElectroDBEntityMock<TData = unknown>(): ElectroDBEntityMock<TData> {
  // Get operation: Entity.get({key}).go()
  const getMock = jest.fn<() => Promise<{data: TData | undefined} | undefined>>()
  const get = jest.fn(() => ({go: getMock}))

  // Scan operation: Entity.scan().go() or Entity.scan().where(...).go()
  const scanGoMock = jest.fn<() => Promise<{data: TData[]} | undefined>>()
  const scanWhereMock = jest.fn(() => ({go: scanGoMock}))
  const scan = {
    go: scanGoMock,
    where: scanWhereMock
  }

  // Create operation: Entity.create(item).go()
  const createGoMock = jest.fn<() => Promise<{data: TData}>>()
  const create = jest.fn(() => ({go: createGoMock}))

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

  // Delete operation: Entity.delete({key}).go()
  const deleteGoMock = jest.fn<() => Promise<void>>()
  const deleteOp = jest.fn(() => ({go: deleteGoMock}))

  return {
    entity: {
      get,
      scan,
      create,
      update,
      delete: deleteOp
    },
    mocks: {
      get: getMock,
      scan: {
        go: scanGoMock,
        where: scanWhereMock
      },
      create: createGoMock,
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
