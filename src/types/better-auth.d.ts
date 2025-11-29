/**
 * Better Auth type utilities
 *
 * These types are extracted from Better Auth's API for use in tests and type-safe code.
 */

import type {auth} from '../lib/vendor/BetterAuth/config'

/**
 * Parameters for Better Auth's signInSocial API method.
 * Extracted from the actual Better Auth instance to ensure type safety.
 */
export type SignInSocialParams = Parameters<typeof auth.api.signInSocial>[0]

/**
 * Result from Better Auth's signInSocial API method.
 * Used for mocking in tests.
 */
export interface SignInSocialResult {
  user: {
    id: string
    email: string
    name?: string
    createdAt: string | Date
    emailVerified?: boolean
  }
  session: { id: string; expiresAt: number | Date }
  token: string
}
