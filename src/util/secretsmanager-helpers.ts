import axios, {AxiosRequestConfig} from 'axios'
import * as jose from 'jose'
import * as crypto from 'crypto'
import jwksClient from 'jwks-rsa'
import {AppleTokenResponse, ServerVerifiedToken, SignInWithAppleConfig, SignInWithAppleVerifiedToken} from '../types/main'
import {logDebug, logError, logInfo} from './lambda-helpers'
import {UnauthorizedError} from './errors'
let APPLE_CONFIG: SignInWithAppleConfig

/**
 * Retrieves the configuration (object) for Sign In With Apple via Secrets Manager or cache.
 * @returns SignInWithAppleConfig - The configuration object
 * @notExported
 */
export async function getAppleConfig(): Promise<SignInWithAppleConfig> {
  if (APPLE_CONFIG) {
    return APPLE_CONFIG
  }
  APPLE_CONFIG = JSON.parse(process.env.SignInWithAppleConfig) as SignInWithAppleConfig
  return APPLE_CONFIG
}

/**
 * Retrieves the private key for Sign In With Apple via Secrets Manager or cache.
 * @returns string - The private key file
 * @notExported
 */
export async function getApplePrivateKey(): Promise<string> {
  return process.env.SignInWithAppleAuthKey
}

/**
 * Retrieves the private key for user-based login via Secrets Manager or cache.
 * @returns string - The private key file
 * @notExported
 */
export async function getServerPrivateKey(): Promise<string> {
  return process.env.PlatformEncryptionKey
}

/**
 * Creates [a client secret](https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens) for Sign In With Apple
 * @returns string - A JSON Web Token (JWT)
 * @notExported
 */
export async function getAppleClientSecret(): Promise<string> {
  const config = await getAppleConfig()
  const privateKey = await getApplePrivateKey()
  const claims = {
    iss: config.team_id,
    aud: 'https://appleid.apple.com',
    sub: config.client_id
  }
  // Convert EC private key to KeyObject since jose.importPKCS8 expects PKCS#8 format
  const keyObject = crypto.createPrivateKey(privateKey)
  return await new jose.SignJWT(claims).setProtectedHeader({alg: 'ES256', kid: config.key_id}).setIssuedAt().setExpirationTime('24h').sign(keyObject)
}

/**
 * Validates an authorization grant code for Sign In With Apple
 * @param authCode - An authorization grant code.
 * @returns AppleTokenResponse - An Apple [TokenResponse](https://developer.apple.com/documentation/sign_in_with_apple/tokenresponse)
 * @notExported
 */
export async function validateAuthCodeForToken(authCode: string): Promise<AppleTokenResponse> {
  logInfo('validateAuthCodeForToken')
  logDebug('getAppleClientSecret')
  const clientSecret = await getAppleClientSecret()
  logDebug('getAppleConfig')
  const config = await getAppleConfig()
  const requestData = {
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: config.redirect_uri,
    client_id: config.client_id,
    client_secret: clientSecret,
    scope: config.scope
  }
  const options: AxiosRequestConfig = {
    method: 'POST',
    url: 'https://appleid.apple.com/auth/token',
    data: new URLSearchParams(requestData).toString(),
    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
  }
  logDebug('axios <=', options)
  const response = await axios(options)
  const {status, data} = response
  logDebug('axios =>', status.toString())
  logDebug('axios =>', data)
  return data
}

/**
 * Fetches Apple's public key for verifying token signature, then verifies.
 * Used during first-time registration or login.
 * @param token - A JSON Web Token (JWT)
 * @returns SignInWithAppleVerifiedToken - A verified token for Sign In With Apple.
 * @notExported
 */
export async function verifyAppleToken(token: string): Promise<SignInWithAppleVerifiedToken> {
  logInfo('verifyAppleToken')
  // decode the token (insecurely), to determine the appropriate public key
  try {
    const decodedHeader = jose.decodeProtectedHeader(token)
    logDebug('verifyAppleToken.decodedHeader', decodedHeader)
    const kid = decodedHeader.kid

    // Verify the nonce for the authentication
    // Verify that the iss field contains https://appleid.apple.com
    // Verify that the aud field is the developer’s client_id
    // Verify that the time is earlier than the exp value of the token

    // lookup Apple's public keys (via JSON) and convert to a proper key file
    logInfo('verifyAppleToken.jwksClient')
    const client = jwksClient({jwksUri: 'https://appleid.apple.com/auth/keys'})
    logDebug('verifyAppleToken.jwksClient.client', client)
    logDebug('verifyAppleToken.jwksClient.client.getSigningKey', client.getSigningKey)
    const key = await client.getSigningKey(kid)
    logDebug('verifyAppleToken.key', key)
    if (typeof key === 'object' && ('rsaPublicKey' in key || 'publicKey' in key)) {
      const publicKey = 'rsaPublicKey' in key ? key.rsaPublicKey : key.publicKey
      const {payload} = await jose.jwtVerify(token, crypto.createPublicKey(publicKey))
      const jwtPayload = payload as SignInWithAppleVerifiedToken
      logDebug('verifyAppleToken.jwtPayload <=', jwtPayload)
      logDebug(`verifyAppleToken.jwtPayload.typeof <= ${typeof jwtPayload}`)
      return jwtPayload
    } else {
      const message = 'Public key not present in payload'
      logError(`jwt.verify <= ${message}`)
      throw new UnauthorizedError(message)
    }
  } catch (err) {
    logError(`verifyAppleToken.err <= ${err}`)
    logError(`verifyAppleToken.err <= ${JSON.stringify(err)}`)
    const message = 'Invalid token'
    logError(`jwt.verify <= ${message}`)
    throw new UnauthorizedError(message)
  }
}

/**
 * Creates an access token using server encryption key for user-login.
 * @param userId - The userId to tokenize.
 * @returns string - A JSON Web Token (JWT)
 */
export async function createAccessToken(userId: string): Promise<string> {
  const secret = await getServerPrivateKey()
  return await new jose.SignJWT({userId}).setProtectedHeader({alg: 'HS256'}).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(secret))
}

/**
 * Verifies an access token using server encryption key (user-login).
 * @param token - A JSON Web Token (JWT)
 * @returns ServerVerifiedToken - A verified token for user login.
 * @notExported
 */
export async function verifyAccessToken(token: string): Promise<ServerVerifiedToken> {
  const secret = await getServerPrivateKey()
  try {
    const {payload} = await jose.jwtVerify(token, new TextEncoder().encode(secret))
    const jwtPayload = payload as ServerVerifiedToken
    logDebug('verifyAccessToken.jwtPayload <=', jwtPayload)
    return jwtPayload
  } catch (err) {
    logError(`verifyAccessToken <= ${err}`)
    throw err
  }
}

/**
 * Retrieves the GitHub access token via Secrets Manager or cache.
 * @returns string - The GitHub personal access token
 * @notExported
 */
export async function getGithubPersonalToken(): Promise<string> {
  return process.env.GithubPersonalToken
}

/**
 * Retrieves the GitHub access token via Secrets Manager or cache.
 * @returns string - The GitHub personal access token
 * @notExported
 */
export async function getApnsSigningKey(): Promise<string> {
  return process.env.ApnsSigningKey
}
