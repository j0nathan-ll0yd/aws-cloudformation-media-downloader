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
