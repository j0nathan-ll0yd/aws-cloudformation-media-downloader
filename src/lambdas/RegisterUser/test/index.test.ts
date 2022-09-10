import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import * as chai from 'chai'
import * as sinon from 'sinon'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as SecretsManagerHelper from '../../../util/secretsmanager-helpers'
import * as LambdaHelper from '../../../util/lambda-helpers'
import {fakeJWT, getFixture, testContext} from '../../../util/mocha-setup'
import {handler} from '../src'
import {APIGatewayEvent} from 'aws-lambda'
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client'
import {AppleTokenResponse, SignInWithAppleVerifiedToken, User} from '../../../types/main'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#RegisterUser', () => {
  const mockResponse = localFixture('axios-200-OK.json')
  const event = localFixture('APIGatewayEvent.json') as APIGatewayEvent
  const context = testContext
  let createAccessTokenStub: sinon.SinonStub
  let mock: MockAdapter
  let putItemStub: sinon.SinonStub
  let validateAuthCodeForTokenStub: sinon.SinonStub
  let verifyAppleTokenStub: sinon.SinonStub
  let getUsersByAppleDeviceIdentifierStub: sinon.SinonStub
  beforeEach(() => {
    mock = new MockAdapter(axios)
    createAccessTokenStub = sinon.stub(SecretsManagerHelper, 'createAccessToken').returns(Promise.resolve(fakeJWT))
    putItemStub = sinon.stub(DynamoDB, 'putItem').returns(localFixture('putItem-200-OK.json') as Promise<DocumentClient.PutItemOutput>)
    validateAuthCodeForTokenStub = sinon.stub(SecretsManagerHelper, 'validateAuthCodeForToken').returns(localFixture('validateAuthCodeForToken-200-OK.json') as Promise<AppleTokenResponse>)
    verifyAppleTokenStub = sinon.stub(SecretsManagerHelper, 'verifyAppleToken').returns(localFixture('verifyAppleToken-200-OK.json') as Promise<SignInWithAppleVerifiedToken>)
    getUsersByAppleDeviceIdentifierStub = sinon.stub(LambdaHelper, 'getUsersByAppleDeviceIdentifier').returns(localFixture('getUsersByAppleDeviceIdentifier-200-OK.json') as Promise<User[]>)
  })
  afterEach(() => {
    createAccessTokenStub.restore()
    getUsersByAppleDeviceIdentifierStub.restore()
    putItemStub.restore()
    validateAuthCodeForTokenStub.restore()
    verifyAppleTokenStub.restore()
    mock.reset()
  })
  it('should successfully register a user, if they dont exist', async () => {
    getUsersByAppleDeviceIdentifierStub.returns([])
    mock.onAny().reply(200, mockResponse)
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body.token).to.be.a('string')
  })
  it('should successfully login a user, if they do exist', async () => {
    mock.onAny().reply(200, mockResponse)
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body.token).to.be.a('string')
  })
  it('should handle an invalid payload', async () => {
    event.body = ''
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
  })
})
