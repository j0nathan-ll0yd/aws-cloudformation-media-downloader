import {jest} from '@jest/globals'

/**
 * Drizzle Entity Mock Structure
 * Provides type-safe mocks for all common entity operations with Drizzle ORM
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Jest-ESM-Mocking-Strategy | Jest ESM Mocking Strategy}
 */
interface DrizzleEntityMock<TData> {
  /** The entity object to pass to jest.unstable_mockModule */
  entity: {
    get: jest.Mock
    scan?: {go: jest.Mock}
    query: {
      byUser?: jest.Mock
      byFile?: jest.Mock
      byDevice?: jest.Mock
      byStatus?: jest.Mock
      byStatusRetryAfter?: jest.Mock
      byKey?: jest.Mock
      byEmail?: jest.Mock
      byProvider?: jest.Mock
      byIdentifier?: jest.Mock
      byToken?: jest.Mock
      byAppleDeviceId?: jest.Mock
    }
    create: jest.Mock
    upsert: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }
  /** Individual mock functions for assertions and setup */
  mocks: {
    get: jest.Mock<() => Promise<{data: TData | TData[] | null; unprocessed?: unknown[]}>>
    scan?: {go: jest.Mock<() => Promise<{data: TData[]; cursor: string | null}>>}
    query: {
      byUser?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byFile?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byDevice?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byStatus?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byStatusRetryAfter?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byKey?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byEmail?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byProvider?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byIdentifier?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byToken?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
      byAppleDeviceId?: {go: jest.Mock<() => Promise<{data: TData[]}>>}
    }
    create: jest.Mock<() => Promise<{data: TData}>>
    upsert: {go: jest.Mock<() => Promise<{data: TData}>>}
    update: {go: jest.Mock<() => Promise<{data: TData}>>; set: jest.Mock}
    delete: jest.Mock<() => Promise<Record<string, never> | {unprocessed: unknown[]}>>
  }
}

type QueryIndexName =
  | 'byUser'
  | 'byFile'
  | 'byDevice'
  | 'byStatus'
  | 'byStatusRetryAfter'
  | 'byKey'
  | 'byEmail'
  | 'byProvider'
  | 'byIdentifier'
  | 'byToken'
  | 'byAppleDeviceId'

/**
 * Creates a complete mock for a Drizzle-based entity
 *
 * Supports all common entity operations: get, scan, query, create, update, delete
 * Matches the ElectroDB-compatible interface layer over Drizzle ORM
 *
 * @param options - Configuration options
 * @param options.queryIndexes - Array of query index names to mock
 * @param options.hasScan - Whether the entity has a scan operation
 * @returns Object with entity mock and individual mock functions
 *
 * @example
 * ```typescript
 * const usersMock = createDrizzleEntityMock<UserItem>({queryIndexes: ['byEmail', 'byAppleDeviceId']})
 * jest.unstable_mockModule('#entities/Users', () => ({Users: usersMock.entity}))
 *
 * // Set up return values
 * usersMock.mocks.get.mockResolvedValue({data: mockUser})
 * usersMock.mocks.query.byEmail!.go.mockResolvedValue({data: [mockUser]})
 * ```
 */
export function createDrizzleEntityMock<TData = unknown>(options?: {queryIndexes?: QueryIndexName[]; hasScan?: boolean}): DrizzleEntityMock<TData> {
  // Get operation: Entity.get({key}).go() or Entity.get([...]).go()
  // Single: returns {data: T | null}
  // Batch: returns {data: T[], unprocessed: []}
  const getMock = jest.fn<() => Promise<{data: TData | TData[] | null; unprocessed?: unknown[]}>>()
  const get = jest.fn(() => ({go: getMock}))

  // Scan operation: Entity.scan.go() - only for Devices
  let scan: {go: jest.Mock} | undefined
  let scanGoMock: jest.Mock<() => Promise<{data: TData[]; cursor: string | null}>> | undefined
  if (options?.hasScan) {
    scanGoMock = jest.fn<() => Promise<{data: TData[]; cursor: string | null}>>()
    scan = {go: scanGoMock}
  }

  // Query operations: Entity.query.byIndex({key}).go()
  const queryEntity: Partial<Record<QueryIndexName, jest.Mock>> = {}
  const queryMocks: Partial<Record<QueryIndexName, {go: jest.Mock}>> = {}

  if (options?.queryIndexes) {
    for (const indexName of options.queryIndexes) {
      const queryGoMock = jest.fn<() => Promise<{data: TData[]}>>()
      const queryIndexMock = jest.fn(() => ({go: queryGoMock}))

      queryEntity[indexName] = queryIndexMock
      queryMocks[indexName] = {go: queryGoMock}
    }
  }

  // Create operation: Entity.create(item).go()
  const createGoMock = jest.fn<() => Promise<{data: TData}>>()
  const create = jest.fn(() => ({go: createGoMock}))

  // Upsert operation: Entity.upsert(item).go()
  const upsertGoMock = jest.fn<() => Promise<{data: TData}>>()
  const upsert = jest.fn(() => ({go: upsertGoMock}))

  // Update operation: Entity.update({key}).set({...}).go()
  const updateGoMock = jest.fn<() => Promise<{data: TData}>>()
  const updateSetMock = jest.fn(() => ({go: updateGoMock}))
  const update = jest.fn(() => ({set: updateSetMock}))

  // Delete operation: Entity.delete({key}).go() or Entity.delete([...]).go()
  // Single: returns {}
  // Batch: returns {unprocessed: []}
  const deleteGoMock = jest.fn<() => Promise<Record<string, never> | {unprocessed: unknown[]}>>()
  const deleteOp = jest.fn(() => ({go: deleteGoMock}))

  const entity: DrizzleEntityMock<TData>['entity'] = {get, query: queryEntity, create, upsert, update, delete: deleteOp}

  if (scan) {
    entity.scan = scan
  }

  const mocks: DrizzleEntityMock<TData>['mocks'] = {
    get: getMock,
    query: queryMocks as DrizzleEntityMock<TData>['mocks']['query'],
    create: createGoMock,
    upsert: {go: upsertGoMock},
    update: {go: updateGoMock, set: updateSetMock},
    delete: deleteGoMock
  }

  if (scanGoMock) {
    mocks.scan = {go: scanGoMock}
  }

  return {entity, mocks}
}

/**
 * Creates a mock for the Drizzle client
 * Used when mocking src/lib/vendor/Drizzle/client
 *
 * @returns Mock Drizzle client with chainable query methods
 *
 * @example
 * ```typescript
 * const drizzleMock = createDrizzleClientMock()
 * jest.unstable_mockModule('#lib/vendor/Drizzle/client', () => ({
 *   getDrizzleClient: jest.fn().mockResolvedValue(drizzleMock.client)
 * }))
 *
 * // Set up return values
 * drizzleMock.mocks.select.where.mockReturnValue({limit: () => mockResult})
 * ```
 */
export function createDrizzleClientMock() {
  const limitMock = jest.fn()
  const whereMock = jest.fn(() => ({limit: limitMock}))
  const fromMock = jest.fn(() => ({where: whereMock, limit: limitMock}))
  const selectMock = jest.fn(() => ({from: fromMock}))

  const returningMock = jest.fn()
  const insertWhereMock = jest.fn(() => ({returning: returningMock}))
  const valuesMock = jest.fn(() => ({returning: returningMock, where: insertWhereMock}))
  const insertMock = jest.fn(() => ({values: valuesMock}))

  const updateReturningMock = jest.fn()
  const updateWhereMock = jest.fn(() => ({returning: updateReturningMock}))
  const setMock = jest.fn(() => ({where: updateWhereMock, returning: updateReturningMock}))
  const updateMock = jest.fn(() => ({set: setMock}))

  const deleteWhereMock = jest.fn()
  const deleteMock = jest.fn(() => ({where: deleteWhereMock}))

  const transactionMock = jest.fn()

  return {
    client: {select: selectMock, insert: insertMock, update: updateMock, delete: deleteMock, transaction: transactionMock},
    mocks: {
      select: {mock: selectMock, from: fromMock, where: whereMock, limit: limitMock},
      insert: {mock: insertMock, values: valuesMock, returning: returningMock},
      update: {mock: updateMock, set: setMock, where: updateWhereMock, returning: updateReturningMock},
      delete: {mock: deleteMock, where: deleteWhereMock},
      transaction: transactionMock
    }
  }
}
