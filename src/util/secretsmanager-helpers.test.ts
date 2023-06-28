import * as chai from 'chai'
import {
  createAccessToken,
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
} from './secretsmanager-helpers'
import * as jwt from 'jsonwebtoken'
import {JsonWebTokenError, JwtPayload} from 'jsonwebtoken'
import * as sinon from 'sinon'
import * as SecretsManager from '../lib/vendor/AWS/SecretsManager'
import * as MockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import {SignInWithAppleVerifiedToken} from '../types/main'
import {UnauthorizedError} from './errors'
import * as JwksRsa from 'jwks-rsa'
import {fakePrivateKey, fakePublicKey} from './mocha-setup'
const expect = chai.expect

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
  exp: 1660525825,
  iat: 1660439425,
  sub: '000185.7720315570fc49d99a265f9af4b46879.2034',
  at_hash: 'U_Bxoy9yUIRYDfczHsG1gw',
  email: 'webmaster@lifegames.org',
  email_verified: true,
  is_private_email: false,
  auth_time: 1660439421,
  nonce_supported: true
}

const fakeApplePublicKey = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2Zc5d0+zkZ5AKmtYTvxH
c3vRc41YfbklflxG9SWsg5qXUxvfgpktGAcxXLFAd9Uglzow9ezvmTGce5d3DhAY
KwHAEPT9hbaMDj7DfmEwuNO8UahfnBkBXsCoUaL3QITF5/DAPsZroTqs7tkQQZ7q
PkQXCSu2aosgOJmaoKQgwcOdjD0D49ne2B/dkxBcNCcJT9pTSWJ8NfGycjWAQsvC
8CGstH8oKwhC5raDcc2IGXMOQC7Qr75d6J5Q24CePHj/JD7zjbwYy9KNH8wyr829
eO/G4OEUW50FAN6HKtvjhJIguMl/1BLZ93z2KJyxExiNTZBUBQbbgCNBfzTv7Jrx
MwIDAQAB
-----END PUBLIC KEY-----
`

const fakeAppleRsaPublicKey = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2Zc5d0+zkZ5AKmtYTvxH
c3vRc41YfbklflxG9SWsg5qXUxvfgpktGAcxXLFAd9Uglzow9ezvmTGce5d3DhAY
KwHAEPT9hbaMDj7DfmEwuNO8UahfnBkBXsCoUaL3QITF5/DAPsZroTqs7tkQQZ7q
PkQXCSu2aosgOJmaoKQgwcOdjD0D49ne2B/dkxBcNCcJT9pTSWJ8NfGycjWAQsvC
8CGstH8oKwhC5raDcc2IGXMOQC7Qr75d6J5Q24CePHj/JD7zjbwYy9KNH8wyr829
eO/G4OEUW50FAN6HKtvjhJIguMl/1BLZ93z2KJyxExiNTZBUBQbbgCNBfzTv7Jrx
MwIDAQAB
-----END PUBLIC KEY-----
`

const fakeKeyPayload = {
  kid: 'W6WcOKB',
  alg: 'RS256',
  publicKey: fakeApplePublicKey,
  rsaPublicKey: fakeAppleRsaPublicKey
}

describe('#Util:SecretsManager', () => {
  let getSecretValueStub: sinon.SinonStub
  let jwksClientSigningKeyStub: sinon.SinonStub
  let mock: MockAdapter
  beforeEach(() => {
    getSecretValueStub = sinon.stub(SecretsManager, 'getSecretValue')
    jwksClientSigningKeyStub = sinon.stub(JwksRsa.JwksClient.prototype, 'getSigningKey').resolves(fakeKeyPayload)
    mock = new MockAdapter(axios)
  })
  afterEach(() => {
    getSecretValueStub.restore()
    jwksClientSigningKeyStub.restore()
    mock.reset()
  })
  it('should getAppleConfig', async () => {
    const jsonString = '{"client_id":"lifegames.OfflineMediaDownloader","team_id":"XXXXXX","redirect_uri":"","key_id":"XXXXXX","scope":"email name"}'
    getSecretValueStub.returns(Promise.resolve({SecretString: jsonString}))
    const responseOne = await getAppleConfig()
    expect(responseOne).to.have.all.keys('client_id', 'team_id', 'redirect_uri', 'key_id', 'scope')
    const responseTwo = await getAppleConfig()
    expect(responseTwo).to.have.all.keys('client_id', 'team_id', 'redirect_uri', 'key_id', 'scope')
    expect(responseOne).to.eql(responseTwo)
    expect(getSecretValueStub.calledOnce)
  })
  it('should getApplePrivateKey', async () => {
    getSecretValueStub.returns(Promise.resolve({SecretString: fakePrivateKey}))
    const responseOne = await getApplePrivateKey()
    expect(responseOne).to.have.length.greaterThan(0)
    const responseTwo = await getApplePrivateKey()
    expect(responseTwo).to.have.length.greaterThan(0)
    expect(responseOne).to.eql(responseTwo)
    expect(getSecretValueStub.calledOnce)
  })
  it('should getServerPrivateKey', async () => {
    const secretString = 'randomly-generated-secret-id'
    process.env.EncryptionKeySecretId = 'PrivateEncryptionKey'
    getSecretValueStub.returns(Promise.resolve({SecretString: secretString}))
    const responseOne = await getServerPrivateKey()
    expect(responseOne).to.have.length.greaterThan(0)
    const responseTwo = await getServerPrivateKey()
    expect(responseTwo).to.have.length.greaterThan(0)
    expect(responseOne).to.eql(responseTwo)
    expect(getSecretValueStub.calledOnce)
  })
  it('should getGithubPersonalToken', async () => {
    const secretString = 'GithubPersonalToken'
    getSecretValueStub.returns(Promise.resolve({SecretString: secretString}))
    const responseOne = await getGithubPersonalToken()
    expect(responseOne).to.have.length.greaterThan(0)
    const responseTwo = await getGithubPersonalToken()
    expect(responseTwo).to.have.length.greaterThan(0)
    expect(responseOne).to.eql(responseTwo)
    expect(getSecretValueStub.calledOnce)
  })
  it('should getApplePushNotificationServiceKey', async () => {
    getSecretValueStub.returns(Promise.resolve({SecretString: fakePrivateKey}))
    const responseOne = await getApplePushNotificationServiceKey()
    expect(responseOne).to.have.length.greaterThan(0)
    const responseTwo = await getApplePushNotificationServiceKey()
    expect(responseTwo).to.have.length.greaterThan(0)
    expect(responseOne).to.eql(responseTwo)
    expect(getSecretValueStub.calledOnce)
  })
  it('should getApplePushNotificationServiceCert', async () => {
    getSecretValueStub.returns(Promise.resolve({SecretString: fakePrivateKey}))
    const responseOne = await getApplePushNotificationServiceCert()
    expect(responseOne).to.have.length.greaterThan(0)
    const responseTwo = await getApplePushNotificationServiceCert()
    expect(responseTwo).to.have.length.greaterThan(0)
    expect(responseOne).to.eql(responseTwo)
    expect(getSecretValueStub.calledOnce)
  })
  it('should getAppleClientSecret', async () => {
    const token = await getAppleClientSecret()
    const jwtPayload = jwt.verify(token, fakePublicKey)
    expect(jwtPayload).to.have.all.keys('iss', 'aud', 'sub', 'iat', 'exp')
  })
  it('should validateAuthCodeForToken', async () => {
    mock.onAny().reply(200, fakeTokenResponse)
    const data = await validateAuthCodeForToken('test')
    expect(data).to.have.all.keys(Object.keys(fakeTokenResponse))
  })
  it('should createAccessToken', async () => {
    const secretString = 'randomly-generated-secret-id'
    process.env.EncryptionKeySecretId = 'PrivateEncryptionKey'
    getSecretValueStub.returns(Promise.resolve({SecretString: secretString}))
    const userId = '1234'
    const token = await createAccessToken(userId)
    const jwtPayload = jwt.verify(token, secretString) as JwtPayload
    expect(jwtPayload).to.have.all.keys('userId', 'iat', 'exp')
    expect(jwtPayload.userId).to.eql(userId)
  })
  it('should verifyAccessToken successfully', async () => {
    const secretString = 'randomly-generated-secret-id'
    process.env.EncryptionKeySecretId = 'PrivateEncryptionKey'
    getSecretValueStub.returns(Promise.resolve({SecretString: secretString}))
    const userId = '1234'
    const token = await createAccessToken(userId)
    const jwtPayload = await verifyAccessToken(token)
    expect(jwtPayload).to.have.all.keys('userId', 'iat', 'exp')
    expect(jwtPayload['userId']).to.eql(userId)
  })
  it('should verifyAccessToken unsuccessfully', async () => {
    const token = 'invalid-token'
    await expect(verifyAccessToken(token)).to.be.rejectedWith(JsonWebTokenError)
  })
  it('should verifyAppleToken successfully', async () => {
    const jwtVerifyStub = sinon.stub(jwt, 'verify').resolves(fakeTokenPayload)
    const token = jwt.sign(fakeTokenPayload, fakePrivateKey, {header: fakeTokenHeader, algorithm: 'ES256'})
    const newToken = await verifyAppleToken(token)
    jwtVerifyStub.restore()
    expect(newToken).to.have.all.keys('iss', 'aud', 'sub', 'iat', 'exp', 'at_hash', 'email', 'email_verified', 'is_private_email', 'auth_time', 'nonce_supported')
  })
  it('should verifyAppleToken handle an unexpected string payload', async () => {
    const jwtVerifyStub = sinon.stub(jwt, 'verify').throws('a string')
    const token = jwt.sign(fakeTokenPayload, fakePrivateKey, {header: fakeTokenHeader, algorithm: 'ES256'})
    await expect(verifyAppleToken(token)).to.be.rejectedWith(UnauthorizedError)
    jwtVerifyStub.restore()
  })
  it('should verifyAppleToken handle token verification error', async () => {
    const token = jwt.sign(fakeTokenPayload, fakePrivateKey, {header: fakeTokenHeader, algorithm: 'ES256'})
    await expect(verifyAppleToken(token)).to.be.rejectedWith(UnauthorizedError)
  })
  it('should verifyAppleToken handle invalid token header', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {rsaPublicKey, ...fakeKeyPayloadWithoutHeader} = fakeKeyPayload
    jwksClientSigningKeyStub.returns(Promise.resolve(fakeKeyPayloadWithoutHeader))
    const token = jwt.sign(fakeTokenPayload, fakePrivateKey, {header: fakeTokenHeader, algorithm: 'ES256'})
    await expect(verifyAppleToken(token)).to.be.rejectedWith(UnauthorizedError)
  })
  it('should verifyAppleToken handle invalid token', async () => {
    await expect(verifyAppleToken('invalid-token')).to.be.rejectedWith(UnauthorizedError)
  })
})
