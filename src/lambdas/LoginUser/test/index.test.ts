import * as sinon from 'sinon'
import chai from 'chai'
import * as DynamoDB from '../../../lib/vendor/AWS/DynamoDB'
import * as SecretsManagerHelper from '../../../util/secretsmanager-helpers'
import {fakeJWT, getFixture} from '../../../util/mocha-setup'
import {handler} from '../src'
const expect = chai.expect
const localFixture = getFixture.bind(null, __dirname)

describe('#LoginUser', () => {
  const context = localFixture('Context.json')
  let createAccessTokenStub
  let event
  let scanStub
  let validateAuthCodeForTokenStub
  let verifyAppleTokenStub
  beforeEach(() => {
    createAccessTokenStub = sinon.stub(SecretsManagerHelper, 'createAccessToken').returns(Promise.resolve(fakeJWT))
    event = localFixture('APIGatewayEvent.json')
    scanStub = sinon.stub(DynamoDB, 'scan')
    validateAuthCodeForTokenStub = sinon.stub(SecretsManagerHelper, 'validateAuthCodeForToken').returns(localFixture('validateAuthCodeForToken-200-OK.json'))
    verifyAppleTokenStub = sinon.stub(SecretsManagerHelper, 'verifyAppleToken').returns(localFixture('verifyAppleToken-200-OK.json'))
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
    event.body = {}
    const output = await handler(event, context)
    expect(output.statusCode).to.equal(400)
  })
})
