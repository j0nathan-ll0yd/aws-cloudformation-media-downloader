import * as sinon from 'sinon'
import * as chai from 'chai'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB.js'
import * as SecretsManagerHelper from '../../../util/secretsmanager-helpers.js'
import {fakeJWT, getFixture, testContext} from '../../../util/mocha-setup.js'
import {handler} from '../src/index.js'
import {APIGatewayEvent} from 'aws-lambda'
import {AppleTokenResponse, SignInWithAppleVerifiedToken} from '../../../types/main'
import {UnexpectedError} from '../../../util/errors.js'
const expect = chai.expect
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localFixture = getFixture.bind(null, __dirname)

describe('#LoginUser', () => {
  const context = testContext
  let createAccessTokenStub: sinon.SinonStub
  let event: APIGatewayEvent
  let scanStub: sinon.SinonStub
  let validateAuthCodeForTokenStub: sinon.SinonStub
  let verifyAppleTokenStub: sinon.SinonStub
  beforeEach(() => {
    createAccessTokenStub = sinon.stub(SecretsManagerHelper, 'createAccessToken').returns(Promise.resolve(fakeJWT))
    event = localFixture('APIGatewayEvent.json') as APIGatewayEvent
    scanStub = sinon.stub(DynamoDB, 'scan')
    const validateAuthResponse = localFixture('validateAuthCodeForToken-200-OK.json') as Promise<AppleTokenResponse>
    validateAuthCodeForTokenStub = sinon.stub(SecretsManagerHelper, 'validateAuthCodeForToken').returns(validateAuthResponse)
    const verifyAppleResponse = localFixture('validateAuthCodeForToken-200-OK.json') as Promise<SignInWithAppleVerifiedToken>
    verifyAppleTokenStub = sinon.stub(SecretsManagerHelper, 'verifyAppleToken').returns(verifyAppleResponse)
  })
  afterEach(() => {
    createAccessTokenStub.restore()
    scanStub.restore()
    validateAuthCodeForTokenStub.restore()
    verifyAppleTokenStub.restore()
  })
  it('should successfully login a user', async () => {
    scanStub.returns(localFixture('scan-200-OK.json'))
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(200)
    const body = JSON.parse(output.body)
    expect(body.body.token).to.be.a('string')
  })
  it('should throw an error if a user is not found', async () => {
    scanStub.returns(localFixture('scan-404-NotFound.json'))
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(404)
    const body = JSON.parse(output.body)
    expect(body.error.code).to.equal('custom-4XX-generic')
    expect(body.error.message).to.equal("User doesn't exist")
  })
  it('should throw an error if duplicates are found', async () => {
    scanStub.returns(localFixture('scan-300-MultipleChoices.json'))
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(300)
    const body = JSON.parse(output.body)
    expect(body.error.code).to.equal('custom-3XX-generic')
    expect(body.error.message).to.equal('Duplicate user detected')
  })
  it('should reject an invalid request', async () => {
    event.body = 'not-JSON'
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
  })
  describe('#AWSFailure', () => {
    it('AWS.DynamoDB.DocumentClient.scan', async () => {
      scanStub.returns(undefined)
      expect(handler(event, context)).to.be.rejectedWith(UnexpectedError)
    })
  })
})
