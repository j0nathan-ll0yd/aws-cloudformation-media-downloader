/**
 * Drizzle ORM Mock Utilities
 *
 * Provides reusable mock patterns for Drizzle database operations.
 * Used by Lambdas that directly query the database.
 *
 * @see {@link https://github.com/j0nathan-ll0yd/mantle-OfflineMediaDownloader/wiki/Vitest-Mocking-Strategy | Vitest Mocking Strategy}
 */
import {type Mock, vi} from 'vitest'

/**
 * Creates a chainable Drizzle delete mock.
 * Supports: delete(table).where(condition).returning()
 *
 * @example
 * ```typescript
 * const {deleteMock, mocks} = createDrizzleDeleteMock()
 * vi.mock('#lib/vendor/Drizzle/client', () => ({
 *   getDrizzleClient: vi.fn(async () => ({delete: deleteMock}))
 * }))
 *
 * // In tests:
 * mocks.returning.mockResolvedValueOnce([{id: 'deleted-1'}])
 * ```
 */
export function createDrizzleDeleteMock() {
  const returningMock = vi.fn<() => Promise<Array<Record<string, unknown>>>>()
  const whereMock = vi.fn(() => ({returning: returningMock}))
  const deleteMock = vi.fn(() => ({where: whereMock}))

  return {deleteMock, mocks: {delete: deleteMock, where: whereMock, returning: returningMock}}
}

/**
 * Creates a Drizzle execute mock for raw SQL queries.
 * Supports: db.execute(sql)
 *
 * @example
 * ```typescript
 * const {executeMock} = createDrizzleExecuteMock()
 * vi.mock('#lib/vendor/Drizzle/client', () => ({
 *   getDrizzleClient: vi.fn(async () => ({execute: executeMock}))
 * }))
 *
 * // In tests:
 * executeMock.mockResolvedValueOnce([{version: '0001'}])
 * ```
 */
export function createDrizzleExecuteMock() {
  const executeMock = vi.fn<() => Promise<Array<Record<string, unknown>>>>()

  return {executeMock, mocks: {execute: executeMock}}
}

/**
 * Creates a chainable Drizzle select mock.
 * Supports: select().from(table).where(condition)
 *
 * @example
 * ```typescript
 * const {selectMock, mocks} = createDrizzleSelectMock()
 * vi.mock('#lib/vendor/Drizzle/client', () => ({
 *   getDrizzleClient: vi.fn(async () => ({select: selectMock}))
 * }))
 *
 * // In tests:
 * mocks.where.mockResolvedValueOnce([{id: 'user-1', email: 'test@example.com'}])
 * ```
 */
export function createDrizzleSelectMock() {
  const whereMock = vi.fn<() => Promise<Array<Record<string, unknown>>>>()
  const fromMock = vi.fn(() => ({where: whereMock}))
  const selectMock = vi.fn(() => ({from: fromMock}))

  return {selectMock, mocks: {select: selectMock, from: fromMock, where: whereMock}}
}

/**
 * Creates mock implementations for drizzle-orm operators.
 * Use with vi.mock('drizzle-orm', () =\> createDrizzleOperatorMocks())
 *
 * @example
 * ```typescript
 * vi.mock('drizzle-orm', () => createDrizzleOperatorMocks())
 * ```
 */
export function createDrizzleOperatorMocks() {
  return {
    and: vi.fn((...args: unknown[]) => args),
    or: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((col: unknown, val: unknown) => ({col, val, op: 'eq'})),
    lt: vi.fn((col: unknown, val: unknown) => ({col, val, op: 'lt'})),
    gt: vi.fn((col: unknown, val: unknown) => ({col, val, op: 'gt'})),
    lte: vi.fn((col: unknown, val: unknown) => ({col, val, op: 'lte'})),
    gte: vi.fn((col: unknown, val: unknown) => ({col, val, op: 'gte'})),
    ne: vi.fn((col: unknown, val: unknown) => ({col, val, op: 'ne'})),
    isNull: vi.fn((col: unknown) => ({col, op: 'isNull'})),
    isNotNull: vi.fn((col: unknown) => ({col, op: 'isNotNull'})),
    inArray: vi.fn((col: unknown, values: unknown[]) => ({col, values, op: 'inArray'})),
    notInArray: vi.fn((col: unknown, values: unknown[]) => ({col, values, op: 'notInArray'})),
    sql: {raw: vi.fn((s: string) => s)}
  }
}

/**
 * Creates a chainable Drizzle insert mock.
 * Supports: insert(table).values(data).returning()
 * Also supports: insert(table).values(data).onConflictDoUpdate(...).returning()
 * Also supports: insert(table).values(data).onConflictDoNothing(...).returning()
 *
 * @example
 * ```typescript
 * const {insertMock, mocks} = createDrizzleInsertMock()
 * vi.mock('#lib/vendor/Drizzle/client', () => ({
 *   getDrizzleClient: vi.fn(async () => ({insert: insertMock}))
 * }))
 *
 * // In tests:
 * mocks.returning.mockResolvedValueOnce([{id: 'new-1'}])
 * ```
 */
export function createDrizzleInsertMock() {
  const returningMock = vi.fn<() => Promise<Array<Record<string, unknown>>>>()
  const onConflictDoUpdateMock = vi.fn(() => ({returning: returningMock}))
  const onConflictDoNothingMock = vi.fn(() => ({returning: returningMock}))
  const valuesMock = vi.fn(() => ({returning: returningMock, onConflictDoUpdate: onConflictDoUpdateMock, onConflictDoNothing: onConflictDoNothingMock}))
  const insertMock = vi.fn(() => ({values: valuesMock}))

  return {
    insertMock,
    mocks: {
      insert: insertMock,
      values: valuesMock,
      returning: returningMock,
      onConflictDoUpdate: onConflictDoUpdateMock,
      onConflictDoNothing: onConflictDoNothingMock
    }
  }
}

/**
 * Creates a chainable Drizzle update mock.
 * Supports: update(table).set(data).where(condition).returning()
 *
 * @example
 * ```typescript
 * const {updateMock, mocks} = createDrizzleUpdateMock()
 * vi.mock('#lib/vendor/Drizzle/client', () => ({
 *   getDrizzleClient: vi.fn(async () => ({update: updateMock}))
 * }))
 *
 * // In tests:
 * mocks.returning.mockResolvedValueOnce([{id: 'updated-1'}])
 * ```
 */
export function createDrizzleUpdateMock() {
  const returningMock = vi.fn<() => Promise<Array<Record<string, unknown>>>>()
  const whereMock = vi.fn(() => ({returning: returningMock}))
  const setMock = vi.fn(() => ({where: whereMock, returning: returningMock}))
  const updateMock = vi.fn(() => ({set: setMock}))

  return {updateMock, mocks: {update: updateMock, set: setMock, where: whereMock, returning: returningMock}}
}

/**
 * Creates a combined Drizzle client mock with all operation capabilities.
 * Supports select, insert, update, delete, and execute operations.
 *
 * @example
 * ```typescript
 * const {clientMock, mocks} = createDrizzleClientMock()
 * vi.mock('#lib/vendor/Drizzle/client', () => ({
 *   getDrizzleClient: vi.fn(async () => clientMock)
 * }))
 *
 * // In tests:
 * mocks.returning.mockResolvedValueOnce([{fileId: 'f1'}])
 * mocks.execute.mockResolvedValueOnce([{version: '0001'}])
 * ```
 */
export function createDrizzleClientMock() {
  const {deleteMock, mocks: deleteMocks} = createDrizzleDeleteMock()
  const {executeMock, mocks: executeMocks} = createDrizzleExecuteMock()
  const {selectMock, mocks: selectMocks} = createDrizzleSelectMock()
  const {insertMock, mocks: insertMocks} = createDrizzleInsertMock()
  const {updateMock, mocks: updateMocks} = createDrizzleUpdateMock()

  const clientMock = {delete: deleteMock, execute: executeMock, select: selectMock, insert: insertMock, update: updateMock}

  return {clientMock, mocks: {...deleteMocks, ...executeMocks, ...selectMocks, ...insertMocks, ...updateMocks}}
}

/**
 * Creates mock schema table references for Drizzle schema mocks.
 * Returns a simple object mapping column names to themselves.
 *
 * @example
 * ```typescript
 * vi.mock('#lib/vendor/Drizzle/schema', () =\> ({
 *   fileDownloads: createMockSchemaTable(['fileId', 'status', 'updatedAt']),
 *   sessions: createMockSchemaTable(['id', 'expiresAt']),
 *   verification: createMockSchemaTable(['id', 'expiresAt'])
 * }))
 * ```
 */
export function createMockSchemaTable(columns: string[]): Record<string, string> {
  return Object.fromEntries(columns.map((col) => [col, col]))
}

// Re-export types for convenience
export type DrizzleDeleteMock = ReturnType<typeof createDrizzleDeleteMock>
export type DrizzleExecuteMock = ReturnType<typeof createDrizzleExecuteMock>
export type DrizzleSelectMock = ReturnType<typeof createDrizzleSelectMock>
export type DrizzleInsertMock = ReturnType<typeof createDrizzleInsertMock>
export type DrizzleUpdateMock = ReturnType<typeof createDrizzleUpdateMock>
export type DrizzleClientMock = ReturnType<typeof createDrizzleClientMock>
export type DrizzleOperatorMocks = ReturnType<typeof createDrizzleOperatorMocks>
export type { Mock }
