/**
 * Type-safe mock helpers for entity queries.
 *
 * Provides utilities to create type-checked mocks for entity query functions.
 * These helpers ensure that mocks match the actual query function signatures.
 *
 * Usage:
 * ```typescript
 * import {mockResolvedQuery, mockNotFound} from 'test/helpers/entity-query-mocks'
 * import {getUser, createUser} from '#entities/queries'
 *
 * vi.mock('#entities/queries', () => ({getUser: vi.fn(), createUser: vi.fn()}))
 *
 * beforeEach(() => {
 *   mockResolvedQuery(vi.mocked(getUser), createMockUser())
 *   mockNotFound(vi.mocked(createUser))
 * })
 * ```
 *
 * @see docs/wiki/Testing/Vitest-Mocking-Strategy.md for patterns
 */
import type {Mock} from 'vitest'

type AnyMock = Mock<(...args: unknown[]) => unknown>

/**
 * Sets up a mock to resolve with a specific value.
 * Type-safe wrapper around mockResolvedValue.
 *
 * @param mock - The mock function to configure
 * @param value - The value to resolve with
 * @returns The mock for chaining
 */
export function mockResolvedQuery<T>(mock: AnyMock, value: T): AnyMock {
  return mock.mockResolvedValue(value)
}

/**
 * Sets up a mock to reject with an error.
 * Type-safe wrapper around mockRejectedValue.
 *
 * @param mock - The mock function to configure
 * @param error - The error to reject with
 * @returns The mock for chaining
 */
export function mockRejectedQuery(mock: AnyMock, error: Error): AnyMock {
  return mock.mockRejectedValue(error)
}

/**
 * Sets up a mock to resolve with null (for not-found cases).
 * Common pattern for getXxx queries that return T | null.
 *
 * @param mock - The mock function to configure
 * @returns The mock for chaining
 */
export function mockNotFound(mock: AnyMock): AnyMock {
  return mock.mockResolvedValue(null)
}

/**
 * Sets up a mock to resolve with an empty array.
 * Common pattern for getXxxByYyy queries that return T[].
 *
 * @param mock - The mock function to configure
 * @returns The mock for chaining
 */
export function mockEmptyArray(mock: AnyMock): AnyMock {
  return mock.mockResolvedValue([])
}

/**
 * Sets up a mock to resolve successfully for void functions.
 * Common pattern for deleteXxx queries that return Promise<void>.
 *
 * @param mock - The mock function to configure
 * @returns The mock for chaining
 */
export function mockVoidSuccess(mock: AnyMock): AnyMock {
  return mock.mockResolvedValue(undefined)
}
