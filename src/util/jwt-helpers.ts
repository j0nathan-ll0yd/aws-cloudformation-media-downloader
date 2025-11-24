import * as jose from 'jose'
import {logDebug, logError} from './lambda-helpers'
import {UnauthorizedError} from './errors'

let privateKey: jose.KeyLike
let publicKey: jose.KeyLike

/**
 * Loads RSA key pair from environment variables
 * Keys are cached after first load for performance
 * @returns RSA key pair for JWT signing and verification
 */
async function getKeyPair(): Promise<{privateKey: jose.KeyLike; publicKey: jose.KeyLike}> {
  if (privateKey && publicKey) {
    return {privateKey, publicKey}
  }

  const privateKeyPem = process.env.JWT_PRIVATE_KEY
  const publicKeyPem = process.env.JWT_PUBLIC_KEY

  if (!privateKeyPem || !publicKeyPem) {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required')
  }

  privateKey = await jose.importPKCS8(privateKeyPem, 'RS256')
  publicKey = await jose.importSPKI(publicKeyPem, 'RS256')

  return {privateKey, publicKey}
}

/**
 * Creates an access token (short-lived, 15 minutes)
 * @param userId - The user ID to encode in the token
 * @param sessionId - Optional session ID for session tracking
 * @returns JWT access token signed with RS256
 */
export async function createAccessToken(userId: string, sessionId?: string): Promise<string> {
  const {privateKey} = await getKeyPair()

  const payload: {userId: string; sessionId?: string} = {userId}
  if (sessionId) {
    payload.sessionId = sessionId
  }

  return await new jose.SignJWT(payload)
    .setProtectedHeader({alg: 'RS256', typ: 'JWT'})
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('media-downloader')
    .sign(privateKey)
}

/**
 * Creates a refresh token (long-lived, 30 days)
 * @param userId - The user ID to encode in the token
 * @param sessionId - The session ID for this token
 * @returns JWT refresh token signed with RS256
 */
export async function createRefreshToken(userId: string, sessionId: string): Promise<string> {
  const {privateKey} = await getKeyPair()

  return await new jose.SignJWT({userId, sessionId, type: 'refresh'})
    .setProtectedHeader({alg: 'RS256', typ: 'JWT'})
    .setIssuedAt()
    .setExpirationTime('30d')
    .setIssuer('media-downloader')
    .sign(privateKey)
}

/**
 * Verifies an access or refresh token
 * @param token - The JWT to verify
 * @returns Decoded payload
 * @throws UnauthorizedError if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<jose.JWTPayload> {
  const {publicKey} = await getKeyPair()

  try {
    const {payload} = await jose.jwtVerify(token, publicKey, {
      issuer: 'media-downloader'
    })
    logDebug('verifyToken.payload', payload)
    return payload
  } catch (err) {
    logError('verifyToken.error', err)
    throw new UnauthorizedError('Invalid or expired token')
  }
}

/**
 * Validates access token and returns userId
 * @param token - The access token to validate
 * @returns User ID and optional session ID from token
 * @throws UnauthorizedError if token is invalid or is a refresh token
 */
export async function validateAccessToken(token: string): Promise<{userId: string; sessionId?: string}> {
  const payload = await verifyToken(token)

  if (!payload.userId) {
    throw new UnauthorizedError('Token missing userId')
  }

  if (payload.type === 'refresh') {
    throw new UnauthorizedError('Cannot use refresh token as access token')
  }

  return {
    userId: payload.userId as string,
    sessionId: payload.sessionId as string | undefined
  }
}

/**
 * Validates refresh token and returns session info
 * @param token - The refresh token to validate
 * @returns User ID and session ID from token
 * @throws UnauthorizedError if token is invalid or is not a refresh token
 */
export async function validateRefreshToken(token: string): Promise<{userId: string; sessionId: string}> {
  const payload = await verifyToken(token)

  if (!payload.userId || !payload.sessionId) {
    throw new UnauthorizedError('Invalid refresh token')
  }

  if (payload.type !== 'refresh') {
    throw new UnauthorizedError('Not a refresh token')
  }

  return {
    userId: payload.userId as string,
    sessionId: payload.sessionId as string
  }
}
