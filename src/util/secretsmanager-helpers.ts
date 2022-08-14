import axios, {AxiosRequestConfig} from 'axios'
import {getSecretValue} from '../lib/vendor/AWS/SecretsManager'
import jwt, {SignOptions} from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import {promisify} from 'util'
import {AppleTokenResponse, ServerVerifiedToken, SignInWithAppleConfig, SignInWithAppleVerifiedToken} from '../types/main'
import {logDebug, logError, logInfo} from './lambda-helpers'
import {UnauthorizedError} from './errors'
let APPLE_CONFIG
let APPLE_PRIVATEKEY
let PRIVATEKEY

export async function getAppleConfig(): Promise<SignInWithAppleConfig> {
  if (APPLE_CONFIG) {
    return APPLE_CONFIG
  }
  const configSecretResponse = await getSecretValue({
    SecretId: 'prod/SignInWithApple/Config'
  })
  APPLE_CONFIG = JSON.parse(configSecretResponse.SecretString) as SignInWithAppleConfig
  return APPLE_CONFIG
}

export async function getApplePrivateKey(): Promise<string> {
  if (APPLE_PRIVATEKEY) {
    return APPLE_PRIVATEKEY
  }
  const authKeySecretResponse = await getSecretValue({
    SecretId: 'prod/SignInWithApple/AuthKey'
  })
  APPLE_PRIVATEKEY = authKeySecretResponse.SecretString
  return APPLE_PRIVATEKEY
}

export async function getServerPrivateKey(): Promise<string> {
  if (PRIVATEKEY !== undefined) {
    return PRIVATEKEY
  }
  // This SecretId has to map to the CloudFormation file (LoginUser)
  logDebug('getSecretValue', {SecretId: process.env.EncryptionKeySecretId})
  const privateKeySecretResponse = await getSecretValue({
    SecretId: process.env.EncryptionKeySecretId
  })
  logDebug('getSecretValue', privateKeySecretResponse)
  PRIVATEKEY = privateKeySecretResponse.SecretString
  return PRIVATEKEY
}

export async function getAppleClientSecret(): Promise<string> {
  const config = await getAppleConfig()
  const privateKey = await getApplePrivateKey()
  const headers = {
    kid: config.key_id,
    typ: undefined
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
  logDebug('axios =>', status)
  logDebug('axios =>', data)
  return data
}

export async function verifyAppleToken(token: string): Promise<SignInWithAppleVerifiedToken> {
  logInfo('verifyAppleToken')
  // decode the token (insecurely), to determine the appropriate public key
  try {
    const decodedPayload = jwt.decode(token, { complete: true })
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
    if ('rsaPublicKey' in key) {
      try {
        const jwtPayload = jwt.verify(token, key.rsaPublicKey) as SignInWithAppleVerifiedToken
        logDebug('verifyAppleToken.jwtPayload <=', jwtPayload)
        logDebug(`verifyAppleToken.jwtPayload.typeof <= ${typeof jwtPayload}`)
        if (typeof jwtPayload === 'string') {
          throw new UnauthorizedError('Invalid JWT payload')
        }
        return jwtPayload
      } catch (error) {
        const message = `Token verification error: ${error.message}`
        logError(`jwt.verify <= ${message}`)
        throw new UnauthorizedError(message)
      }
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

export async function createAccessToken(userId: string): Promise<string> {
  const secret = await getServerPrivateKey()
  return jwt.sign({userId}, secret, {
    expiresIn: 86400 // expires in 24 hours
  })
}

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
