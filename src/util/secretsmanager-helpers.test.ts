import {describe, expect, test, jest} from '@jest/globals'
import {AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from 'axios'
import {SignInWithAppleVerifiedToken} from '../types/main'
import {UnauthorizedError} from './errors'
import {fakePrivateKey, fakePublicKey} from './jest-setup'
import * as jose from 'jose'
import * as crypto from 'crypto'

const fakeTokenResponse = {
  access_token: 'accessToken',
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: 'refreshToken',
  id_token: 'idToken'
}
const fakeTokenHeader = {
  kid: 'W6WcOKB',
  alg: 'ES256'
}
const fakeTokenPayload: SignInWithAppleVerifiedToken = {
  iss: 'https://appleid.apple.com',
  aud: 'lifegames.OfflineMediaDownloader',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: 1660439425,
  sub: '000185.7720315570fc49d99a265f9af4b46879.2034',
  at_hash: 'U_Bxoy9yUIRYDfczHsG1gw',
  email: 'webmaster@lifegames.org',
  email_verified: true,
  is_private_email: false,
  auth_time: 1660439421,
  nonce_supported: true
}

const axiosGetMock = jest.fn()
jest.unstable_mockModule('axios', () => ({
  default: axiosGetMock
}))

function mockAxiosResponse(config: AxiosRequestConfig): AxiosResponse {
  return {
    config: config as InternalAxiosRequestConfig,
    data: fakeTokenResponse,
    status: 200,
    statusText: 'OK',
    headers: {}
  }
}

const getSigningKeyMock = jest.fn()
jest.unstable_mockModule('jwks-rsa', () => ({
  __esModule: true,
  default: (options: object) => {
    console.log('mocked jwks-rsa', options)
    return {
      getSigningKey: getSigningKeyMock
    }
  }
}))

const signWithAppleConfigString = '{"client_id":"lifegames.OfflineMediaDownloader","team_id":"XXXXXX","redirect_uri":"","key_id":"XXXXXX","scope":"email name"}'
const signInWithAppleAuthKeyString = fakePrivateKey

const {getApnsSigningKey, getAppleClientSecret, validateAuthCodeForToken, verifyAppleToken} = await import('./secretsmanager-helpers')

describe('#Util:SecretsManager', () => {
  test('should getAppleClientSecret', async () => {
    process.env.SignInWithAppleConfig = signWithAppleConfigString
    process.env.SignInWithAppleAuthKey = signInWithAppleAuthKeyString
    const token = await getAppleClientSecret()
    const {payload: jwtPayload} = await jose.jwtVerify(token, crypto.createPublicKey(fakePublicKey))
    const expectedKeys = ['iss', 'aud', 'sub', 'iat', 'exp']
    expect(Object.keys(jwtPayload)).toEqual(expect.arrayContaining(expectedKeys))
  })
  test('should validateAuthCodeForToken', async () => {
    process.env.SignInWithAppleConfig = signWithAppleConfigString
    process.env.SignInWithAppleAuthKey = signInWithAppleAuthKeyString
    axiosGetMock.mockImplementation(() => {
      const config = axiosGetMock.mock.calls[0][0] as AxiosRequestConfig
      return mockAxiosResponse(config)
    })
    const data = await validateAuthCodeForToken('test')
    expect(Object.keys(data)).toEqual(expect.arrayContaining(Object.keys(fakeTokenResponse)))
  })
  test('should verifyAppleToken successfully', async () => {
    getSigningKeyMock.mockReturnValue({publicKey: fakePublicKey})
    const token = await new jose.SignJWT(fakeTokenPayload).setProtectedHeader(fakeTokenHeader).sign(crypto.createPrivateKey(fakePrivateKey))
    const newToken = await verifyAppleToken(token)
    const expectedKeys = ['iss', 'aud', 'sub', 'iat', 'exp', 'at_hash', 'email', 'email_verified', 'is_private_email', 'auth_time', 'nonce_supported']
    expect(Object.keys(newToken)).toEqual(expect.arrayContaining(expectedKeys))
  })
  test('should verifyAppleToken handle an unexpected string payload', async () => {
    getSigningKeyMock.mockReturnValue('unexpected-string')
    const token = await new jose.SignJWT(fakeTokenPayload).setProtectedHeader(fakeTokenHeader).sign(crypto.createPrivateKey(fakePrivateKey))
    await expect(verifyAppleToken(token)).rejects.toThrow(UnauthorizedError)
  })
  test('should verifyAppleToken handle invalid token', async () => {
    await expect(verifyAppleToken('invalid-token')).rejects.toThrow(UnauthorizedError)
  })
  test('should getApnsSigningKey successfully', async () => {
    process.env.ApnsSigningKey = fakePrivateKey
    const responseOne = await getApnsSigningKey()
    expect(responseOne.length).toBeGreaterThan(0)
    const responseTwo = await getApnsSigningKey()
    expect(responseTwo.length).toBeGreaterThan(0)
    expect(responseOne).toEqual(responseTwo)
  })
})
