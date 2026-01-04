/**
 * Better Auth Helper Utilities
 *
 * Provides type narrowing helpers for Better Auth API responses.
 * Better Auth's OAuth methods can return either redirect responses
 * (for web OAuth flows) or token responses (for ID token flows).
 *
 * Eliminates duplicated type narrowing patterns like:
 * ```typescript
 * if ('url' in rawResult && rawResult.url) {
 *   throw new Error('Unexpected redirect response from Better Auth')
 * }
 * const result = rawResult as TokenResponse
 * ```
 *
 * @see {@link https://www.better-auth.com/docs/concepts/session-management | Better Auth Session Management}
 */

/**
 * User object returned by Better Auth.
 */
export interface BetterAuthUser {
  id: string
  email: string
  name: string
  createdAt: Date
}

/**
 * Session object returned by Better Auth.
 */
export interface BetterAuthSession {
  id: string
  expiresAt: number
}

/**
 * Token response from Better Auth sign-in (non-redirect).
 * This is the expected response for ID token authentication.
 */
export interface BetterAuthTokenResponse {
  redirect: boolean
  token: string
  url: undefined
  user: BetterAuthUser
  session?: BetterAuthSession
}

/**
 * Redirect response from Better Auth OAuth flow.
 * This occurs during web-based OAuth when redirect is needed.
 */
export interface BetterAuthRedirectResponse {
  redirect: boolean
  url: string
  token?: undefined
  user?: undefined
}

/**
 * Union type for all possible Better Auth OAuth responses.
 */
export type BetterAuthOAuthResponse = BetterAuthTokenResponse | BetterAuthRedirectResponse

/**
 * Type guard to check if response is a redirect response.
 *
 * @param response - Better Auth OAuth response
 * @returns true if the response is a redirect
 */
export function isRedirectResponse(response: BetterAuthOAuthResponse): response is BetterAuthRedirectResponse {
  return 'url' in response && typeof response.url === 'string' && response.url.length > 0
}

/**
 * Type guard to check if response is a token response.
 *
 * @param response - Better Auth OAuth response
 * @returns true if the response is a valid token response with non-empty token
 */
export function isTokenResponse(response: BetterAuthOAuthResponse): response is BetterAuthTokenResponse {
  return 'token' in response && typeof response.token === 'string' && response.token.length > 0 && !isRedirectResponse(response)
}

/**
 * Asserts that a Better Auth response is a token response (non-redirect).
 *
 * @param response - Better Auth OAuth response
 * @returns The token response with proper typing
 * @throws Error if response is a redirect
 *
 * @example
 * ```typescript
 * const result = assertTokenResponse(rawResult)
 * ```
 */
export function assertTokenResponse(response: BetterAuthOAuthResponse): BetterAuthTokenResponse {
  if (isRedirectResponse(response)) {
    throw new Error('Unexpected redirect response from Better Auth - ID token flow should not redirect')
  }
  return response as BetterAuthTokenResponse
}

/**
 * Extracts session expiration as milliseconds timestamp.
 * Falls back to 30 days from now if session expiration is not provided.
 *
 * @param session - Optional Better Auth session object
 * @returns Expiration timestamp in milliseconds
 */
export function getSessionExpirationMs(session?: BetterAuthSession): number {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  return session?.expiresAt || Date.now() + thirtyDaysMs
}

/**
 * Extracts session expiration as ISO string.
 * Convenience wrapper around getSessionExpirationMs.
 *
 * @param session - Optional Better Auth session object
 * @returns Expiration as ISO 8601 string
 */
export function getSessionExpirationISO(session?: BetterAuthSession): string {
  return new Date(getSessionExpirationMs(session)).toISOString()
}
