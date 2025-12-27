import {type Mock, vi} from 'vitest'
import type {SignInSocialParams, SignInSocialResult} from '#types/better-auth'

/**
 * Better Auth Mock Structure
 * Provides type-safe mocks for Better Auth API methods
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Vitest-Mocking-Strategy | Vitest Mocking Strategy}
 */
interface BetterAuthMock {
  /** The auth object to pass to vi.mock */
  auth: {api: {signInSocial: Mock<(params: SignInSocialParams) => Promise<SignInSocialResult>>}}
  /** Individual mock functions for assertions and setup */
  mocks: {signInSocial: Mock<(params: SignInSocialParams) => Promise<SignInSocialResult>>}
}

/**
 * Creates a Better Auth mock with all API methods
 *
 * @returns BetterAuthMock object containing both the module export and individual mocks
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Vitest-Mocking-Strategy | Vitest Mocking Strategy}
 */
export function createBetterAuthMock(): BetterAuthMock {
  const signInSocialMock = vi.fn<(params: SignInSocialParams) => Promise<SignInSocialResult>>()

  return {auth: {api: {signInSocial: signInSocialMock}}, mocks: {signInSocial: signInSocialMock}}
}
