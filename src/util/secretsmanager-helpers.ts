import axios, {AxiosRequestConfig} from 'axios'
import querystring from 'querystring'
import {getSecretValue} from '../lib/vendor/AWS/SecretsManager'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import {promisify} from 'util'
import {AppleTokenResponse} from '../types/main'
import {logDebug, logError} from './lambda-helpers'
let APPLE_CONFIG
let APPLE_PRIVATEKEY
let PRIVATEKEY

export async function getAppleConfig() {
  if (APPLE_CONFIG) {
    return APPLE_CONFIG
  }
  const configSecretResponse = await getSecretValue({SecretId: 'prod/SignInWithApple/Config'})
  APPLE_CONFIG = JSON.parse(configSecretResponse.SecretString)
  return APPLE_CONFIG
}

export async function getApplePrivateKey() {
  if (APPLE_PRIVATEKEY) {
    return APPLE_PRIVATEKEY
  }
  const authKeySecretResponse = await getSecretValue({SecretId: 'prod/SignInWithApple/AuthKey'})
  APPLE_PRIVATEKEY = authKeySecretResponse.SecretString
  return APPLE_PRIVATEKEY
}

export async function getServerPrivateKey() {
  if (PRIVATEKEY) {
    return PRIVATEKEY
  }
  // This SecretId has to map to the CloudFormation file (LoginUser)
  logDebug('getSecretValue', {SecretId: process.env.EncryptionKeySecretId})
  const privateKeySecretResponse = await getSecretValue({SecretId: process.env.EncryptionKeySecretId})
  logDebug('getSecretValue', privateKeySecretResponse)
  PRIVATEKEY = privateKeySecretResponse.SecretString
  return PRIVATEKEY
}

export async function getAppleClientSecret() {
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
  const token = jwt.sign(claims, privateKey, {
    algorithm: 'ES256',
    header: headers,
    expiresIn: '24h'
  })
  return token
}

export async function validateAuthCodeForToken(authCode: string): Promise<AppleTokenResponse> {
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
    data: querystring.stringify(requestData),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }
  logDebug('axios <=', options)
  const response = await axios(options)
  const {status, data} = response
  logDebug('axios =>', status)
  logDebug('axios =>', data)
  return data
}

export async function verifyAppleToken(token: string) {
  // decode the token (insecurely), to determine the appropriate public key
  const decodedPayload = jwt.decode(token, {complete: true})
  const kid = decodedPayload.header.kid

  // Verify the nonce for the authentication
  // Verify that the iss field contains https://appleid.apple.com
  // Verify that the aud field is the developer’s client_id
  // Verify that the time is earlier than the exp value of the token

  // lookup Apple's public keys (via JSON) and convert to a proper key file
  const client = jwksClient({ jwksUri: 'https://appleid.apple.com/auth/keys' })
  const getSigningKey = promisify(client.getSigningKey)
  const key = await getSigningKey(kid)
  if ('rsaPublicKey' in key) {
    try {
      return jwt.verify(token, key.rsaPublicKey)
    } catch(error) {
      logError(`jwt.verify <= ${error.message}`)
      throw new Error(error)
    }
  } else {
    const message = 'rsaPublicKey not present in payload'
    logError(`jwt.verify <= ${message}`)
    throw new Error(message)
  }
}

export async function createAccessToken(userId: string) {
  const secret = await getServerPrivateKey()
  return jwt.sign({ userId }, secret, {
    expiresIn: 86400 // expires in 24 hours
  })
}

export async function verifyAccessToken(token: string) {
  const secret = await getServerPrivateKey()
  try {
    const decoded = jwt.verify(token, secret)
    return decoded
  } catch(err) {
    // err
  }
}
