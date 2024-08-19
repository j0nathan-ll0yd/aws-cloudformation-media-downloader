import {describe, expect, test, jest} from '@jest/globals'
import {AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from 'axios'
import {ServerVerifiedToken, SignInWithAppleVerifiedToken} from '../types/main'
import {UnauthorizedError, UnexpectedError} from './errors'
import {fakePrivateKey, fakePublicKey} from './jest-setup'
import jwt from 'jsonwebtoken'

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

const getSecretValueMock = jest.fn()
jest.unstable_mockModule('../lib/vendor/AWS/SecretsManager', () => ({
  getSecretValue: getSecretValueMock
}))

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

const {
  createAccessToken,
  getApnsSigningKey,
  getAppleClientSecret,
  getAppleConfig,
  getApplePrivateKey,
  getApplePushNotificationServiceCert,
  getApplePushNotificationServiceKey,
  getGithubPersonalToken,
  getServerPrivateKey,
  validateAuthCodeForToken,
  verifyAccessToken,
  verifyAppleToken
} = await import('./secretsmanager-helpers')

describe('#Util:SecretsManager', () => {
  test('should getAppleConfig', async () => {
    // Testing the error handling first; because upon successful retrieval, the function will cache the response
    getSecretValueMock.mockReturnValue({SecretString: 1234})
    await expect(getAppleConfig()).rejects.toThrow(UnexpectedError)
    const jsonString = '{"client_id":"lifegames.OfflineMediaDownloader","team_id":"XXXXXX","redirect_uri":"","key_id":"XXXXXX","scope":"email name"}'
    getSecretValueMock.mockReturnValue({SecretString: jsonString})
    const responseOne = await getAppleConfig()
    const expectedKeys = ['client_id', 'team_id', 'redirect_uri', 'key_id', 'scope']
    expect(Object.keys(responseOne)).toEqual(expect.arrayContaining(expectedKeys))
    const responseTwo = await getAppleConfig()
    expect(Object.keys(responseTwo)).toEqual(expect.arrayContaining(expectedKeys))
    expect(responseOne).toEqual(responseTwo)
    expect(getSecretValueMock.mock.calls.length).toBe(2)
  })
  test('should getApplePrivateKey', async () => {
    // Testing the error handling first; because upon successful retrieval, the function will cache the response
    getSecretValueMock.mockReturnValue({SecretString: 1234})
    await expect(getApplePrivateKey()).rejects.toThrow(UnexpectedError)
    getSecretValueMock.mockReturnValue({SecretString: fakePrivateKey})
    const responseOne = await getApplePrivateKey()
    expect(responseOne.length).toBeGreaterThan(0)
    const responseTwo = await getApplePrivateKey()
    expect(responseTwo.length).toBeGreaterThan(0)
    expect(responseOne).toEqual(responseTwo)
    expect(getSecretValueMock.mock.calls.length).toBe(2)
  })
  test('should getServerPrivateKey', async () => {
    // Testing the error handling first; because upon successful retrieval, the function will cache the response
    getSecretValueMock.mockReturnValue({SecretString: 1234})
    await expect(getServerPrivateKey()).rejects.toThrow(UnexpectedError)
    const secretString = 'randomly-generated-secret-id'
    process.env.EncryptionKeySecretId = 'PrivateEncryptionKey'
    getSecretValueMock.mockReturnValue({SecretString: secretString})
    const responseOne = await getServerPrivateKey()
    expect(responseOne.length).toBeGreaterThan(0)
    const responseTwo = await getServerPrivateKey()
    expect(responseTwo.length).toBeGreaterThan(0)
    expect(responseOne).toEqual(responseTwo)
    expect(getSecretValueMock.mock.calls.length).toBe(2)
  })
  test('should getGithubPersonalToken', async () => {
    // Testing the error handling first; because upon successful retrieval, the function will cache the response
    getSecretValueMock.mockReturnValue({SecretString: 1234})
    await expect(getGithubPersonalToken()).rejects.toThrow(UnexpectedError)
    const secretString = 'GithubPersonalToken'
    getSecretValueMock.mockReturnValue({SecretString: secretString})
    const responseOne = await getGithubPersonalToken()
    expect(responseOne.length).toBeGreaterThan(0)
    const responseTwo = await getGithubPersonalToken()
    expect(responseTwo.length).toBeGreaterThan(0)
    expect(responseOne).toEqual(responseTwo)
    expect(getSecretValueMock.mock.calls.length).toBe(2)
  })
  test('should getApplePushNotificationServiceKey', async () => {
    // Testing the error handling first; because upon successful retrieval, the function will cache the response
    getSecretValueMock.mockReturnValue({SecretString: 1234})
    await expect(getApplePushNotificationServiceKey()).rejects.toThrow(UnexpectedError)
    getSecretValueMock.mockReturnValue({SecretString: fakePrivateKey})
    const responseOne = await getApplePushNotificationServiceKey()
    expect(responseOne.length).toBeGreaterThan(0)
    const responseTwo = await getApplePushNotificationServiceKey()
    expect(responseTwo.length).toBeGreaterThan(0)
    expect(responseOne).toEqual(responseTwo)
    expect(getSecretValueMock.mock.calls.length).toBe(2)
  })
  test('should getApplePushNotificationServiceCert', async () => {
    // Testing the error handling first; because upon successful retrieval, the function will cache the response
    getSecretValueMock.mockReturnValue({SecretString: 1234})
    await expect(getApplePushNotificationServiceCert()).rejects.toThrow(UnexpectedError)
    getSecretValueMock.mockReturnValue({SecretString: fakePrivateKey})
    const responseOne = await getApplePushNotificationServiceCert()
    expect(responseOne.length).toBeGreaterThan(0)
    const responseTwo = await getApplePushNotificationServiceCert()
    expect(responseTwo.length).toBeGreaterThan(0)
    expect(responseOne).toEqual(responseTwo)
    expect(getSecretValueMock.mock.calls.length).toBe(2)
  })
  test('should getAppleClientSecret', async () => {
    const jsonString = '{"client_id":"lifegames.OfflineMediaDownloader","team_id":"XXXXXX","redirect_uri":"","key_id":"XXXXXX","scope":"email name"}'
    getSecretValueMock.mockReturnValueOnce({SecretString: jsonString})
    getSecretValueMock.mockReturnValueOnce({SecretString: fakePrivateKey})
    const token = await getAppleClientSecret()
    const jwtPayload = jwt.verify(token, fakePublicKey)
    const expectedKeys = ['iss', 'aud', 'sub', 'iat', 'exp']
    expect(Object.keys(jwtPayload)).toEqual(expect.arrayContaining(expectedKeys))
  })
  test('should validateAuthCodeForToken', async () => {
    axiosGetMock.mockImplementation(() => {
      const config = axiosGetMock.mock.calls[0][0] as AxiosRequestConfig
      return mockAxiosResponse(config)
    })
    const data = await validateAuthCodeForToken('test')
    expect(Object.keys(data)).toEqual(expect.arrayContaining(Object.keys(fakeTokenResponse)))
  })
  test('should createAccessToken', async () => {
    const secretString = 'randomly-generated-secret-id'
    process.env.EncryptionKeySecretId = 'PrivateEncryptionKey'
    getSecretValueMock.mockReturnValue({SecretString: secretString})
    const userId = '1234'
    const token = await createAccessToken(userId)
    const jwtPayload = jwt.verify(token, secretString) as ServerVerifiedToken
    const expectedKeys = ['userId', 'iat', 'exp']
    expect(Object.keys(jwtPayload)).toEqual(expect.arrayContaining(expectedKeys))
    expect(jwtPayload.userId).toEqual(userId)
  })
  test('should verifyAccessToken successfully', async () => {
    const secretString = 'randomly-generated-secret-id'
    process.env.EncryptionKeySecretId = 'PrivateEncryptionKey'
    getSecretValueMock.mockReturnValue({SecretString: secretString})
    const userId = '1234'
    const token = await createAccessToken(userId)
    const jwtPayload = await verifyAccessToken(token)
    const expectedKeys = ['userId', 'iat', 'exp']
    expect(Object.keys(jwtPayload)).toEqual(expect.arrayContaining(expectedKeys))
    expect(jwtPayload['userId']).toEqual(userId)
  })
  test('should verifyAccessToken unsuccessfully', async () => {
    const token = 'invalid-token'
    await expect(verifyAccessToken(token)).rejects.toThrow(Error)
  })
  test('should verifyAppleToken successfully', async () => {
    getSigningKeyMock.mockReturnValue({rsaPublicKey: fakePublicKey})
    const token = jwt.sign(fakeTokenPayload, fakePrivateKey, {header: fakeTokenHeader, algorithm: 'ES256'})
    const newToken = await verifyAppleToken(token)
    const expectedKeys = ['iss', 'aud', 'sub', 'iat', 'exp', 'at_hash', 'email', 'email_verified', 'is_private_email', 'auth_time', 'nonce_supported']
    expect(Object.keys(newToken)).toEqual(expect.arrayContaining(expectedKeys))
  })
  test('should verifyAppleToken handle an unexpected string payload', async () => {
    getSigningKeyMock.mockReturnValue('unexpected-string')
    const token = jwt.sign(fakeTokenPayload, fakePrivateKey, {header: fakeTokenHeader, algorithm: 'ES256'})
    await expect(verifyAppleToken(token)).rejects.toThrow(UnauthorizedError)
  })
  test('should verifyAppleToken handle invalid token', async () => {
    await expect(verifyAppleToken('invalid-token')).rejects.toThrow(UnauthorizedError)
  })
  test('should getApnsSigningKey successfully', async () => {
    const secretString = 'randomly-generated-secret-id'
    process.env.EncryptionKeySecretId = 'PrivateEncryptionKey'
    getSecretValueMock.mockReturnValue({SecretString: secretString})
    const responseOne = await getApnsSigningKey()
    expect(responseOne.length).toBeGreaterThan(0)
    const responseTwo = await getApnsSigningKey()
    expect(responseTwo.length).toBeGreaterThan(0)
    expect(responseOne).toEqual(responseTwo)
    expect(getSecretValueMock.mock.calls.length).toBe(1)
  })
})
