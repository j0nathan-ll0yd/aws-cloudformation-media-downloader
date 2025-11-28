import {jest} from '@jest/globals'
import type {MockedFunction} from 'jest-mock'
import type {SignInSocialParams} from '../../src/types/better-auth'

/**
 * Better Auth Mock Structure
 * Provides type-safe mocks for Better Auth API methods
 */
interface BetterAuthMock {
  /**
   * The auth object to pass to jest.unstable_mockModule
   * @example
   * const authMock = createBetterAuthMock()
   * jest.unstable_mockModule('path/to/BetterAuth/config', () => ({ auth: authMock.auth }))
   */
  auth: {
    api: {
      signInSocial: MockedFunction<(params: SignInSocialParams) => Promise<any>>
    }
  }
  /**
   * Individual mock functions for assertions and setup
   * @example
   * authMock.mocks.signInSocial.mockResolvedValue({
   *   user: {id: '123', email: 'test@example.com', ...},
   *   session: {id: 'session-123', expiresAt: Date.now() + 86400000},
   *   token: 'auth-token'
   * })
   * expect(authMock.mocks.signInSocial).toHaveBeenCalledWith(expect.objectContaining({
   *   body: expect.objectContaining({provider: 'apple'})
   * }))
   */
  mocks: {
    signInSocial: MockedFunction<(params: SignInSocialParams) => Promise<any>>
  }
}

/**
 * Creates a Better Auth mock with all API methods
 *
 * @returns BetterAuthMock object containing both the module export and individual mocks
 *
 * @example
 * ```typescript
 * const authMock = createBetterAuthMock()
 *
 * jest.unstable_mockModule('../../../lib/vendor/BetterAuth/config', () => ({
 *   auth: authMock.auth
 * }))
 *
 * // In test
 * authMock.mocks.signInSocial.mockResolvedValue({
 *   user: {id: 'user-123', email: 'test@example.com', createdAt: new Date().toISOString()},
 *   session: {id: 'session-123', expiresAt: Date.now() + 86400000},
 *   token: 'auth-token-xyz'
 * })
 *
 * expect(authMock.mocks.signInSocial).toHaveBeenCalledWith(
 *   expect.objectContaining({
 *     body: expect.objectContaining({provider: 'apple'})
 *   })
 * )
 * ```
 */
export function createBetterAuthMock(): BetterAuthMock {
  const signInSocialMock = jest.fn() as MockedFunction<(params: SignInSocialParams) => Promise<any>>

  return {
    auth: {
      api: {
        signInSocial: signInSocialMock
      }
    },
    mocks: {
      signInSocial: signInSocialMock
    }
  }
}
