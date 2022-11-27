import axios, {AxiosRequestConfig} from 'axios'
import {getSecretValue} from '../lib/vendor/AWS/SecretsManager'
import * as jwt from 'jsonwebtoken'
import {Jwt, SignOptions} from 'jsonwebtoken'
import * as jwksClient from 'jwks-rsa'
import {promisify} from 'util'
import {AppleTokenResponse, ServerVerifiedToken, SignInWithAppleConfig, SignInWithAppleVerifiedToken} from '../types/main'
import {logDebug, logError, logInfo} from './lambda-helpers'
import {UnauthorizedError, UnexpectedError} from './errors'
import {GetSecretValueRequest} from 'aws-sdk/clients/secretsmanager'
let APPLE_CONFIG: SignInWithAppleConfig
let APPLE_PRIVATEKEY: string
let PRIVATEKEY: string
let APPLE_PUSH_NOTIFICATION_SERVICE_KEY: string
let APPLE_PUSH_NOTIFICATION_SERVICE_CERT: string

/**
 * Retrieves the configuration (object) for Sign In With Apple via Secrets Manager or cache.
 * @returns SignInWithAppleConfig - The configuration object
 * @notExported
 */
export async function getAppleConfig(): Promise<SignInWithAppleConfig> {
  if (APPLE_CONFIG) {
    return APPLE_CONFIG
  }
  const params = {SecretId: 'prod/SignInWithApple/Config'}
  logDebug('getAppleConfig =>', params)
  const configSecretResponse = await getSecretValue(params)
  logDebug('getAppleConfig <=', params)
  if (typeof configSecretResponse.SecretString === 'string') {
    APPLE_CONFIG = JSON.parse(configSecretResponse.SecretString) as SignInWithAppleConfig
    return APPLE_CONFIG
  } else {
    throw new UnexpectedError('Error fetching Apple configuration')
  }
}

/**
 * Retrieves the private key for Sign In With Apple via Secrets Manager or cache.
 * @returns string - The private key file
 * @notExported
 */
export async function getApplePrivateKey(): Promise<string> {
  if (APPLE_PRIVATEKEY) {
    return APPLE_PRIVATEKEY
  }
  const params = {SecretId: 'prod/SignInWithApple/AuthKey'}
  logDebug('getApplePrivateKey =>', params)
  const authKeySecretResponse = await getSecretValue(params)
  logDebug('getApplePrivateKey <=', params)
  if (typeof authKeySecretResponse.SecretString === 'string') {
    APPLE_PRIVATEKEY = authKeySecretResponse.SecretString
    return APPLE_PRIVATEKEY
  } else {
    throw new UnexpectedError('Error fetching Apple private key')
  }
}

/**
 * Retrieves the private key for Sign In With Apple via Secrets Manager or cache.
 * @returns string - The private key file
 * @notExported
 */
export async function getApplePushNotificationServiceKey(): Promise<string> {
  if (APPLE_PUSH_NOTIFICATION_SERVICE_KEY) {
    return APPLE_PUSH_NOTIFICATION_SERVICE_KEY
  }
  const params = {SecretId: 'ApplePushNotificationServiceKey'}
  logDebug('getApplePushNotificationServiceKey =>', params)
  const authKeySecretResponse = await getSecretValue(params)
  logDebug('getApplePushNotificationServiceKey <=', params)
  if (typeof authKeySecretResponse.SecretString === 'string') {
    APPLE_PUSH_NOTIFICATION_SERVICE_KEY = authKeySecretResponse.SecretString
    return APPLE_PUSH_NOTIFICATION_SERVICE_KEY
  } else {
    throw new UnexpectedError('Error fetching Apple private key')
  }
}

/**
 * Retrieves the private key for Sign In With Apple via Secrets Manager or cache.
 * @returns string - The private key file
 * @notExported
 */
export async function getApplePushNotificationServiceCert(): Promise<string> {
  if (APPLE_PUSH_NOTIFICATION_SERVICE_CERT) {
    return APPLE_PUSH_NOTIFICATION_SERVICE_CERT
  }
  const params = {SecretId: 'ApplePushNotificationServiceCert'}
  logDebug('getApplePushNotificationServiceCert =>', params)
  const authKeySecretResponse = await getSecretValue(params)
  logDebug('getApplePushNotificationServiceCert <=', params)
  if (typeof authKeySecretResponse.SecretString === 'string') {
    APPLE_PUSH_NOTIFICATION_SERVICE_CERT = authKeySecretResponse.SecretString
    return APPLE_PUSH_NOTIFICATION_SERVICE_CERT
  } else {
    throw new UnexpectedError('Error fetching Apple private key')
  }
}

/**
 * Retrieves the private key for user-based login via Secrets Manager or cache.
 * @returns string - The private key file
 * @notExported
 */
export async function getServerPrivateKey(): Promise<string> {
  if (PRIVATEKEY !== undefined) {
    return PRIVATEKEY
  }
  // This SecretId has to map to the CloudFormation file (LoginUser)
  const params = {SecretId: process.env.EncryptionKeySecretId} as GetSecretValueRequest
  logDebug('getServerPrivateKey =>', params)
  const privateKeySecretResponse = await getSecretValue(params)
  logDebug('getServerPrivateKey <=', privateKeySecretResponse)
  if (typeof privateKeySecretResponse.SecretString === 'string') {
    PRIVATEKEY = privateKeySecretResponse.SecretString
    return PRIVATEKEY
  } else {
    throw new UnexpectedError('Error fetching server private key')
  }
}

/**
 * Creates [a client secret](https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens) for Sign In With Apple
 * @returns string - A JSON Web Token (JWT)
 * @notExported
 */
export async function getAppleClientSecret(): Promise<string> {
  const config = await getAppleConfig()
  const privateKey = await getApplePrivateKey()
  const headers = {
    kid: config.key_id
  }
  const claims = {
    iss: config.team_id,
    aud: 'https://appleid.apple.com',
    sub: config.client_id
  }
  return jwt.sign(claims, privateKey, {
    algorithm: 'ES256',
    header: headers,
    expiresIn: '24h'
  } as SignOptions)
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
    const decodedPayload = jwt.decode(token, {complete: true}) as Jwt
    logDebug('verifyAppleToken.decodedPayload', decodedPayload)
    const kid = decodedPayload.header.kid

    // Verify the nonce for the authentication
    // Verify that the iss field contains https://appleid.apple.com
    // Verify that the aud field is the developer’s client_id
    // Verify that the time is earlier than the exp value of the token

    // lookup Apple's public keys (via JSON) and convert to a proper key file
    logInfo('verifyAppleToken.jwksClient')
    const client = jwksClient({jwksUri: 'https://appleid.apple.com/auth/keys'})
    const getSigningKey = promisify(client.getSigningKey)
    const key = await getSigningKey(kid)
    logDebug('verifyAppleToken.key', key)
    if (typeof key === 'object' && 'rsaPublicKey' in key) {
      const jwtPayload = jwt.verify(token, key.rsaPublicKey) as SignInWithAppleVerifiedToken
      logDebug('verifyAppleToken.jwtPayload <=', jwtPayload)
      logDebug(`verifyAppleToken.jwtPayload.typeof <= ${typeof jwtPayload}`)
      return jwtPayload
    } else {
      const message = 'rsaPublicKey not present in payload'
      logError(`jwt.verify <= ${message}`)
      throw new UnauthorizedError(message)
    }
  } catch (err) {
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
  return jwt.sign({userId}, secret, {
    // expiresIn: 86400 // expires in 24 hours
    expiresIn: 60 * 5
  })
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
    const jwtPayload = jwt.verify(token, secret) as ServerVerifiedToken
    logDebug('verifyAccessToken.jwtPayload <=', jwtPayload)
    return jwtPayload
  } catch (err) {
    logError(`verifyAccessToken <= ${err}`)
    throw err
  }
}
