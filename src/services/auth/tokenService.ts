/**
 * Token Service
 *
 * Extracts and validates user identity from Authorization headers
 * using Better Auth session tokens.
 */
import {logError} from '@mantleframework/observability'
import {validateSessionToken} from '#domain/auth/sessionService'

/**
 * Extract userId from an Authorization header containing a Bearer session token.
 * Returns undefined if the token is invalid or missing.
 *
 * @param authorizationHeader - The full Authorization header value (e.g., "Bearer abc123")
 * @returns The userId if valid, undefined otherwise
 */
export async function getUserIdFromAuthenticationHeader(authorizationHeader: string): Promise<string | undefined> {
  const bearerRegex = /^Bearer [A-Za-z\d-_=.]+$/
  if (!authorizationHeader.match(bearerRegex)) {
    return
  }

  const keypair = authorizationHeader.split(' ')
  const token = keypair[1] ?? ''
  try {
    const payload = await validateSessionToken(token)
    return payload.userId
  } catch (err) {
    logError('invalid session token <=', {error: err instanceof Error ? err.message : String(err)})
    return
  }
}
