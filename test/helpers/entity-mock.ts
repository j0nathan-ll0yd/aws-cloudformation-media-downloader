import {type Mock, vi} from 'vitest'

/**
 * Entity Mock Structure
 * Provides type-safe mocks for all common entity operations
 * (ElectroDB-compatible API over Drizzle implementation)
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Vitest-Mocking-Strategy | Vitest Mocking Strategy}
 */
interface EntityMock<TData> {
  /** The entity object to pass to vi.mock */
  entity: {
    get: Mock
    scan: {go: Mock; where: Mock}
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
    get: Mock<() => Promise<{data: TData | TData[] | undefined; unprocessed?: unknown[]} | undefined>>
    scan: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
    query: {
      byUser?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byFile?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byDevice?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byStatus?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byStatusRetryAfter?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byKey?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byEmail?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byProvider?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byIdentifier?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byToken?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
      byAppleDeviceId?: {go: Mock<() => Promise<{data: TData[]} | undefined>>; where: Mock}
    }
    create: Mock<() => Promise<{data: TData}>>
    upsert: {go: Mock<() => Promise<{data: TData}>>}
    update: {go: Mock<() => Promise<{data: TData} | undefined>>; set: Mock; add: Mock; delete: Mock}
    delete: Mock<() => Promise<{unprocessed?: unknown[]} | void>>
  }
}

/**
 * Creates a complete mock for an entity
 *
 * Supports all common entity operations: get, scan, query, create, update, delete
 * Entities use Drizzle internally but expose ElectroDB-compatible API
 *
 * @param options - Configuration options with queryIndexes array
 * @returns Object with entity mock and individual mock functions
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Vitest-Mocking-Strategy#entity-mock-helper-critical | Entity Mock Helper}
 */
export function createEntityMock<TData = unknown>(options?: {
  queryIndexes?: Array<
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
  >
}): EntityMock<TData> {
  // Get operation: Entity.get({key}).go() or Entity.get([...]).go()
  // Supports both single and batch operations
  const getMock = vi.fn<() => Promise<{data: TData | TData[] | undefined; unprocessed?: unknown[]} | undefined>>()
  const get = vi.fn(() => ({go: getMock}))

  // Scan operation: Entity.scan().go() or Entity.scan().where(...).go()
  const scanGoMock = vi.fn<() => Promise<{data: TData[]} | undefined>>()
  const scanWhereMock = vi.fn(() => ({go: scanGoMock}))
  const scan = {go: scanGoMock, where: scanWhereMock}

  // Query operations: Entity.query.byIndex({key}).go() or Entity.query.byIndex({key}).where(...).go()
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
  const queryEntity: Partial<Record<QueryIndexName, Mock>> = {}
  const queryMocks: Partial<Record<QueryIndexName, {go: Mock; where: Mock}>> = {}

  if (options?.queryIndexes) {
    for (const indexName of options.queryIndexes) {
      const queryGoMock = vi.fn<() => Promise<{data: TData[]} | undefined>>()
      const queryWhereMock = vi.fn(() => ({where: queryWhereMock, go: queryGoMock}))
      const queryIndexMock = vi.fn(() => ({where: queryWhereMock, go: queryGoMock}))

      queryEntity[indexName] = queryIndexMock
      queryMocks[indexName] = {go: queryGoMock, where: queryWhereMock}
    }
  }

  // Create operation: Entity.create(item).go()
  const createGoMock = vi.fn<() => Promise<{data: TData}>>()
  const create = vi.fn(() => ({go: createGoMock}))

  // Upsert operation: Entity.upsert(item).go()
  const upsertGoMock = vi.fn<() => Promise<{data: TData}>>()
  const upsert = vi.fn(() => ({go: upsertGoMock}))

  // Update operation: Entity.update({key}).set/add/delete({...}).go()
  const updateGoMock = vi.fn<() => Promise<{data: TData} | undefined>>()
  const updateSetMock = vi.fn(() => ({go: updateGoMock}))
  const updateAddMock = vi.fn(() => ({go: updateGoMock}))
  const updateDeleteMock = vi.fn(() => ({go: updateGoMock}))
  const update = vi.fn(() => ({set: updateSetMock, add: updateAddMock, delete: updateDeleteMock, go: updateGoMock}))

  // Delete operation: Entity.delete({key}).go() or Entity.delete([...]).go()
  // Supports both single (returns void) and batch (returns {unprocessed}) operations
  const deleteGoMock = vi.fn<() => Promise<{unprocessed?: unknown[]} | void>>()
  const deleteOp = vi.fn(() => ({go: deleteGoMock}))

  return {
    entity: {get, scan, query: queryEntity, create, upsert, update, delete: deleteOp},
    mocks: {
      get: getMock,
      scan: {go: scanGoMock, where: scanWhereMock},
      query: queryMocks as EntityMock<TData>['mocks']['query'],
      create: createGoMock,
      upsert: {go: upsertGoMock},
      update: {go: updateGoMock, set: updateSetMock, add: updateAddMock, delete: updateDeleteMock},
      delete: deleteGoMock
    }
  }
}

/** @deprecated Use createEntityMock instead */
export const createElectroDBEntityMock = createEntityMock
