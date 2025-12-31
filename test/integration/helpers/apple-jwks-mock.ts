/**
 * Apple JWKS Mock Helper
 *
 * Mocks Apple's public key endpoint for testing Better Auth signInSocial.
 * Uses mock-jwks to intercept requests to https://appleid.apple.com/auth/keys
 * and provide test keys for JWT verification.
 *
 * This allows integration tests to use real Better Auth code while only
 * mocking the external network call to Apple's JWKS endpoint.
 */

import {createJWKSMock, type JWKSMock} from 'mock-jwks'

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_JWKS_PATH = '/auth/keys'

// Singleton mock instance
let jwksMock: JWKSMock | null = null
let stopFn: (() => void) | null = null

/**
 * Start the Apple JWKS mock server.
 * Must be called before any Better Auth operations in tests.
 *
 * @returns The JWKS mock instance for generating tokens
 *
 * @example
 * ```typescript
 * beforeAll(() => {
 *   startAppleJWKSMock()
 * })
 * ```
 */
export function startAppleJWKSMock(): JWKSMock {
  if (jwksMock && stopFn) {
    return jwksMock
  }

  jwksMock = createJWKSMock(APPLE_ISSUER, APPLE_JWKS_PATH)
  stopFn = jwksMock.start()

  return jwksMock
}

/**
 * Stop the Apple JWKS mock server.
 * Call in afterAll() to clean up.
 *
 * @example
 * ```typescript
 * afterAll(() => {
 *   stopAppleJWKSMock()
 * })
 * ```
 */
export function stopAppleJWKSMock(): void {
  if (stopFn) {
    stopFn()
    stopFn = null
  }
  jwksMock = null
}

/**
 * Apple ID token claims structure.
 * These are the standard claims Apple includes in ID tokens.
 */
export interface AppleIdTokenClaims {
  /** User ID (Apple's unique identifier for this user) */
  sub: string
  /** User's email address */
  email: string
  /** Whether email is verified (defaults to true) */
  email_verified?: boolean | 'true' | 'false'
  /** Audience - typically the bundle ID or client ID */
  aud?: string
  /** Time at which user authenticated */
  auth_time?: number
  /** Whether nonce is supported */
  nonce_supported?: boolean
}

/**
 * Generate a mock Apple ID token for testing.
 *
 * Creates a properly-signed JWT that will validate against the mock JWKS.
 * The token includes Apple-specific claims required by Better Auth.
 *
 * @param claims - Custom claims to include in the token
 * @returns Signed JWT token string
 * @throws Error if mock is not started
 *
 * @example
 * ```typescript
 * const idToken = generateAppleIdToken({
 *   sub: 'apple-user-123',
 *   email: 'test@example.com',
 * })
 *
 * // Use in test request
 * const result = await loginHandler({body: JSON.stringify({idToken})}, context)
 * ```
 */
export function generateAppleIdToken(claims: AppleIdTokenClaims): string {
  if (!jwksMock) {
    throw new Error('Apple JWKS mock not started. Call startAppleJWKSMock() first.')
  }

  // Generate token with Apple-specific claims
  // Better Auth expects these claims for Apple Sign In verification
  return jwksMock.token({
    iss: APPLE_ISSUER,
    sub: claims.sub,
    aud: claims.aud || 'com.example.app', // Default to test bundle ID
    email: claims.email,
    email_verified: claims.email_verified ?? true,
    auth_time: claims.auth_time ?? Math.floor(Date.now() / 1000),
    nonce_supported: claims.nonce_supported ?? true,
    // Standard JWT claims
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
  })
}

/**
 * Get the mock JWKS instance for advanced usage.
 *
 * @returns The JWKS mock instance, or null if not started
 */
export function getAppleJWKSMock(): JWKSMock | null {
  return jwksMock
}
