import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import chai from 'chai'
import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import {fakeJWT, getFixture} from '../../../util/mocha-setup'
import {handleRegisterUser} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)
import * as dependencyModule from '../../../util/secretsmanager-helpers'

describe('#handleRegisterUser', () => {
  const event = localFixture('APIGatewayEvent.json')
  const context = localFixture('Context.json')
  let createAccessTokenStub
  let mock
  let putItemStub
  let validateAuthCodeForTokenStub
  let verifyAppleTokenStub
  beforeEach(() => {
    mock = new MockAdapter(axios)
    createAccessTokenStub = sinon.stub(dependencyModule, 'createAccessToken')
      .returns(Promise.resolve(fakeJWT))
    putItemStub = sinon.stub(DynamoDB, 'putItem').returns(localFixture('putItem-200-OK.json'))
    validateAuthCodeForTokenStub = sinon.stub(dependencyModule, 'validateAuthCodeForToken')
      .returns(localFixture('validateAuthCodeForToken-200-OK.json'))
    verifyAppleTokenStub = sinon.stub(dependencyModule, 'verifyAppleToken')
      .returns(localFixture('verifyAppleToken-200-OK.json'))
  })
  afterEach(() => {
    createAccessTokenStub.restore()
    putItemStub.restore()
    validateAuthCodeForTokenStub.restore()
    verifyAppleTokenStub.restore()
    mock.reset()
  })
  it('should successfully handle a multipart upload', async () => {
    const mockResponse = localFixture('axios-200-OK.json')
    mock.onAny().reply(200, mockResponse)
    const output = await handleRegisterUser(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body.token).to.be.a('string')
  })
})
