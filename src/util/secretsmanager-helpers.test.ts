import chai from 'chai'
import { getAppleConfig, getApplePrivateKey } from "./secretsmanager-helpers"
import * as sinon from 'sinon'
import * as SecretsManager from '../lib/vendor/AWS/SecretsManager'
const expect = chai.expect

describe('#Util:SecretsManager', () => {
  let getSecretValueStub
  beforeEach(() => {
    getSecretValueStub = sinon.stub(SecretsManager, 'getSecretValue')
  })
  afterEach(() => {
    getSecretValueStub.restore()
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
    const jsonString = '-----BEGIN PRIVATE KEY-----'
    getSecretValueStub.returns(Promise.resolve({SecretString: jsonString}))
    const responseOne = await getApplePrivateKey()
    expect(responseOne).to.have.length.greaterThan(0)
    const responseTwo = await getApplePrivateKey()
    expect(responseTwo).to.have.length.greaterThan(0)
    expect(responseOne).to.eql(responseTwo)
    expect(getSecretValueStub.calledOnce)
  })
  it('should getServerPrivateKey', async () => {
    const jsonString = '-----BEGIN PRIVATE KEY-----'
    getSecretValueStub.returns(Promise.resolve({SecretString: jsonString}))
    const responseOne = await getApplePrivateKey()
    expect(responseOne).to.have.length.greaterThan(0)
    const responseTwo = await getApplePrivateKey()
    expect(responseTwo).to.have.length.greaterThan(0)
    expect(responseOne).to.eql(responseTwo)
    expect(getSecretValueStub.calledOnce)
  })
})
