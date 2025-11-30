import {jest} from '@jest/globals'
import type {
  SignInSocialParams,
  SignInSocialResult
} from '../../src/types/better-auth'

/**
 * Better Auth Mock Structure
 * Provides type-safe mocks for Better Auth API methods
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Jest-ESM-Mocking-Strategy | Jest ESM Mocking Strategy}
 */
interface BetterAuthMock {
  /** The auth object to pass to jest.unstable_mockModule */
  auth: { api: { signInSocial: jest.Mock<(params: SignInSocialParams) => Promise<SignInSocialResult>> } }
  /** Individual mock functions for assertions and setup */
  mocks: { signInSocial: jest.Mock<(params: SignInSocialParams) => Promise<SignInSocialResult>> }
}

/**
 * Creates a Better Auth mock with all API methods
 *
 * @returns BetterAuthMock object containing both the module export and individual mocks
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/Jest-ESM-Mocking-Strategy | Jest ESM Mocking Strategy}
 */
export function createBetterAuthMock(): BetterAuthMock {
  const signInSocialMock = jest.fn<(params: SignInSocialParams) => Promise<SignInSocialResult>>()

  return { auth: { api: { signInSocial: signInSocialMock } }, mocks: { signInSocial: signInSocialMock } }
}
