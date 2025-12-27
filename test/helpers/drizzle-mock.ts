import {type Mock, vi} from 'vitest'

/**
 * Drizzle Entity Mock Structure
 * Provides type-safe mocks for all common entity operations with Drizzle ORM
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Vitest-Mocking-Strategy | Vitest Mocking Strategy}
 */
interface DrizzleEntityMock<TData> {
  /** The entity object to pass to vi.mock */
  entity: {
    get: Mock
    scan?: {go: Mock}
    query: {
      byUser?: Mock
      byFile?: Mock
      byDevice?: Mock
      byStatus?: Mock
      byStatusRetryAfter?: Mock
      byKey?: Mock
      byEmail?: Mock
      byProvider?: Mock
      byIdentifier?: Mock
      byToken?: Mock
      byAppleDeviceId?: Mock
    }
    create: Mock
    upsert: Mock
    update: Mock
    delete: Mock
  }
  /** Individual mock functions for assertions and setup */
  mocks: {
    get: Mock<() => Promise<{data: TData | TData[] | null; unprocessed?: unknown[]}>>
    scan?: {go: Mock<() => Promise<{data: TData[]; cursor: string | null}>>}
    query: {
      byUser?: {go: Mock<() => Promise<{data: TData[]}>>}
      byFile?: {go: Mock<() => Promise<{data: TData[]}>>}
      byDevice?: {go: Mock<() => Promise<{data: TData[]}>>}
      byStatus?: {go: Mock<() => Promise<{data: TData[]}>>}
      byStatusRetryAfter?: {go: Mock<() => Promise<{data: TData[]}>>}
      byKey?: {go: Mock<() => Promise<{data: TData[]}>>}
      byEmail?: {go: Mock<() => Promise<{data: TData[]}>>}
      byProvider?: {go: Mock<() => Promise<{data: TData[]}>>}
      byIdentifier?: {go: Mock<() => Promise<{data: TData[]}>>}
      byToken?: {go: Mock<() => Promise<{data: TData[]}>>}
      byAppleDeviceId?: {go: Mock<() => Promise<{data: TData[]}>>}
    }
    create: Mock<() => Promise<{data: TData}>>
    upsert: {go: Mock<() => Promise<{data: TData}>>}
    update: {go: Mock<() => Promise<{data: TData}>>; set: Mock}
    delete: Mock<() => Promise<Record<string, never> | {unprocessed: unknown[]}>>
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
 * vi.mock('#entities/Users', () => ({Users: usersMock.entity}))
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
  const getMock = vi.fn<() => Promise<{data: TData | TData[] | null; unprocessed?: unknown[]}>>()
  const get = vi.fn(() => ({go: getMock}))

  // Scan operation: Entity.scan.go() - only for Devices
  let scan: {go: Mock} | undefined
  let scanGoMock: Mock<() => Promise<{data: TData[]; cursor: string | null}>> | undefined
  if (options?.hasScan) {
    scanGoMock = vi.fn<() => Promise<{data: TData[]; cursor: string | null}>>()
    scan = {go: scanGoMock}
  }

  // Query operations: Entity.query.byIndex({key}).go()
  const queryEntity: Partial<Record<QueryIndexName, Mock>> = {}
  const queryMocks: Partial<Record<QueryIndexName, {go: Mock}>> = {}

  if (options?.queryIndexes) {
    for (const indexName of options.queryIndexes) {
      const queryGoMock = vi.fn<() => Promise<{data: TData[]}>>()
      const queryIndexMock = vi.fn(() => ({go: queryGoMock}))

      queryEntity[indexName] = queryIndexMock
      queryMocks[indexName] = {go: queryGoMock}
    }
  }

  // Create operation: Entity.create(item).go()
  const createGoMock = vi.fn<() => Promise<{data: TData}>>()
  const create = vi.fn(() => ({go: createGoMock}))

  // Upsert operation: Entity.upsert(item).go()
  const upsertGoMock = vi.fn<() => Promise<{data: TData}>>()
  const upsert = vi.fn(() => ({go: upsertGoMock}))

  // Update operation: Entity.update({key}).set({...}).go()
  const updateGoMock = vi.fn<() => Promise<{data: TData}>>()
  const updateSetMock = vi.fn(() => ({go: updateGoMock}))
  const update = vi.fn(() => ({set: updateSetMock}))

  // Delete operation: Entity.delete({key}).go() or Entity.delete([...]).go()
  // Single: returns {}
  // Batch: returns {unprocessed: []}
  const deleteGoMock = vi.fn<() => Promise<Record<string, never> | {unprocessed: unknown[]}>>()
  const deleteOp = vi.fn(() => ({go: deleteGoMock}))

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
 * vi.mock('#lib/vendor/Drizzle/client', () => ({
 *   getDrizzleClient: vi.fn().mockResolvedValue(drizzleMock.client)
 * }))
 *
 * // Set up return values
 * drizzleMock.mocks.select.where.mockReturnValue({limit: () => mockResult})
 * ```
 */
export function createDrizzleClientMock() {
  const limitMock = vi.fn()
  const whereMock = vi.fn(() => ({limit: limitMock}))
  const fromMock = vi.fn(() => ({where: whereMock, limit: limitMock}))
  const selectMock = vi.fn(() => ({from: fromMock}))

  const returningMock = vi.fn()
  const insertWhereMock = vi.fn(() => ({returning: returningMock}))
  const valuesMock = vi.fn(() => ({returning: returningMock, where: insertWhereMock}))
  const insertMock = vi.fn(() => ({values: valuesMock}))

  const updateReturningMock = vi.fn()
  const updateWhereMock = vi.fn(() => ({returning: updateReturningMock}))
  const setMock = vi.fn(() => ({where: updateWhereMock, returning: updateReturningMock}))
  const updateMock = vi.fn(() => ({set: setMock}))

  const deleteWhereMock = vi.fn()
  const deleteMock = vi.fn(() => ({where: deleteWhereMock}))

  const transactionMock = vi.fn()

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
