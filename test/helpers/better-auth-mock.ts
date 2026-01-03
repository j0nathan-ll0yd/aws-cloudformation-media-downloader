import {type Mock, vi} from 'vitest'
import type {SignInSocialParams, SignInSocialResult} from '#types/better-auth'

/**
 * Session result from Better Auth's getSession API method.
 */
export interface GetSessionResult {
  session: {id: string; userId: string; expiresAt: Date; createdAt: Date; updatedAt: Date; ipAddress?: string; userAgent?: string}
  user: {id: string; email: string; name?: string; emailVerified: boolean; createdAt: Date; updatedAt: Date}
}

/**
 * Parameters for Better Auth's getSession API method.
 */
export interface GetSessionParams {
  headers: Headers
}

/**
 * Parameters for Better Auth's signOut API method.
 */
export interface SignOutParams {
  headers: Headers
}

/**
 * Better Auth Mock Structure
 * Provides type-safe mocks for Better Auth API methods
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Vitest-Mocking-Strategy | Vitest Mocking Strategy}
 */
interface BetterAuthMock {
  /** The auth object to pass to vi.mock */
  auth: {
    api: {
      signInSocial: Mock<(params: SignInSocialParams) => Promise<SignInSocialResult>>
      getSession: Mock<(params: GetSessionParams) => Promise<GetSessionResult | null>>
      signOut: Mock<(params: SignOutParams) => Promise<void>>
    }
  }
  /** Individual mock functions for assertions and setup */
  mocks: {
    signInSocial: Mock<(params: SignInSocialParams) => Promise<SignInSocialResult>>
    getSession: Mock<(params: GetSessionParams) => Promise<GetSessionResult | null>>
    signOut: Mock<(params: SignOutParams) => Promise<void>>
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
 * vi.mock('#lib/vendor/BetterAuth/config', () => ({getAuth: vi.fn(async () => authMock.auth)}))
 *
 * // In tests:
 * authMock.mocks.signInSocial.mockResolvedValue({user: {...}, session: {...}, token: '...'})
 * authMock.mocks.getSession.mockResolvedValue({session: {...}, user: {...}})
 * authMock.mocks.signOut.mockResolvedValue(undefined)
 * ```
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Vitest-Mocking-Strategy | Vitest Mocking Strategy}
 */
export function createBetterAuthMock(): BetterAuthMock {
  const signInSocialMock = vi.fn<(params: SignInSocialParams) => Promise<SignInSocialResult>>()
  const getSessionMock = vi.fn<(params: GetSessionParams) => Promise<GetSessionResult | null>>()
  const signOutMock = vi.fn<(params: SignOutParams) => Promise<void>>()

  return {
    auth: {api: {signInSocial: signInSocialMock, getSession: getSessionMock, signOut: signOutMock}},
    mocks: {signInSocial: signInSocialMock, getSession: getSessionMock, signOut: signOutMock}
  }
}
