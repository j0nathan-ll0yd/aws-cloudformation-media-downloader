import {createFailedUserDeletionIssue} from './github-helpers'
import {Device} from '../types/main'
import {Moctokit} from '@kie/mock-github'
import * as chai from 'chai'
import * as sinon from 'sinon'
import * as SecretsManager from '../lib/vendor/AWS/SecretsManager'
const expect = chai.expect

describe('#Util:GithubHelper', () => {
  let getSecretValueStub: sinon.SinonStub
  beforeEach(() => {
    getSecretValueStub = sinon.stub(SecretsManager, 'getSecretValue')
  })
  afterEach(() => {
    getSecretValueStub.restore()
  })
  it('should createFailedUserDeletionIssue', async () => {
    process.env.GithubPersonalToken = 'GithubPersonalToken'
    getSecretValueStub.returns(Promise.resolve({SecretString: 'GithubPersonalToken'}))
    const userId = '1234'
    const device: Device = {deviceId: '', name: '', systemName: '', systemVersion: '', token: '', endpointArn: 'fakeArn'}
    const error: Error = new Error('test error')
    const requestId = '1234'
    const moctokit = new Moctokit()
    moctokit.rest.issues.create().reply({status: 201, data: {id: 1234}})
    const response = await createFailedUserDeletionIssue(userId, [device], error, requestId)
    expect(response.status).to.equal(201)
    expect(response.data.id).to.equal(1234)
  })
})
