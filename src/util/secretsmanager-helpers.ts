import axios from 'axios'
import {getSecretValue} from '../lib/vendor/AWS/SecretsManager'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import {promisify} from 'util'
import {logDebug, logError} from './lambda-helpers'
let SIGNIN_WITH_APPLE_CONFIG
let SIGNIN_WITH_APPLE_PRIVATEKEY

export async function getSignInWithAppleConfig() {
  if (SIGNIN_WITH_APPLE_CONFIG) {
    return SIGNIN_WITH_APPLE_CONFIG
  }
  const configSecretResponse = await getSecretValue({SecretId: 'prod/SignInWithApple/Config'})
  SIGNIN_WITH_APPLE_CONFIG = JSON.parse(configSecretResponse.SecretString)
  return SIGNIN_WITH_APPLE_CONFIG
}

export async function getSignInWithApplePrivateKey() {
  if (SIGNIN_WITH_APPLE_PRIVATEKEY) {
    return SIGNIN_WITH_APPLE_PRIVATEKEY
  }
  const authKeySecretResponse = await getSecretValue({SecretId: 'prod/SignInWithApple/AuthKey'})
  SIGNIN_WITH_APPLE_PRIVATEKEY = authKeySecretResponse.SecretString
  return SIGNIN_WITH_APPLE_PRIVATEKEY
}

export async function getSignInWithAppleClientSecret() {
  const config = await getSignInWithAppleConfig()
  const privateKey = await getSignInWithApplePrivateKey()
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

export async function verifyAppleToken(token: string) {
  // decode the token (insecurely), to determine the appropriate public key
  const decodedPayload = jwt.decode(token, {complete: true})
  const kid = decodedPayload.header.kid

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
  return jwt.sign({ userId }, 'my secret', {
    expiresIn: 86400 // expires in 24 hours
  })
}

export async function verifyAccessToken(token: string) {
  try {
    const decoded = jwt.verify(token, 'my secret')
  } catch(err) {
    // err
  }
}
