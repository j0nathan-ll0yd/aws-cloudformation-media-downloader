import {APIGatewayRequestAuthorizerEvent} from 'aws-lambda'
import * as SecretsManagerHelper from './../../../util/secretsmanager-helpers.js'
import * as APIGateway from '../../../lib/vendor/AWS/ApiGateway.js'
import * as sinon from 'sinon'
import {getFixture} from '../../../util/mocha-setup.js'
import * as chai from 'chai'
import * as crypto from 'crypto'
import {v4 as uuidv4} from 'uuid'
import {handler} from '../src/index.js'
import {ApiKeys} from 'aws-sdk/clients/apigateway'
import {UnexpectedError} from '../../../util/errors.js'
const expect = chai.expect
import path from 'path'
import {fileURLToPath} from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const localFixture = getFixture.bind(null, __dirname)
const fakeUserId = uuidv4()
const fakeUsageIdentifierKey = crypto.randomBytes(48).toString('hex')
const unauthorizedError = new Error('Unauthorized')

describe('#APIGatewayAuthorizer', () => {
  // Setup variations of the getApiKeys response
  const getApiKeysResponse = localFixture('getApiKeys.json') as ApiKeys
  const getApiKeysDefaultResponse = JSON.parse(JSON.stringify(getApiKeysResponse))
  getApiKeysDefaultResponse.items![0].value = fakeUsageIdentifierKey
  describe('#HeaderApiKey', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = localFixture('Event.json') as APIGatewayRequestAuthorizerEvent
      event.queryStringParameters!['ApiKey'] = fakeUsageIdentifierKey
      process.env.MultiAuthenticationPathParts = 'files'
    })
    afterEach(() => {
      sinon.restore()
    })
    it('should throw an error if there is no API key', async () => {
      delete event.queryStringParameters!['ApiKey']
      expect(handler(event)).to.be.rejectedWith(unauthorizedError)
    })
    it('should throw an error if the API key is invalid', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      event.queryStringParameters!['ApiKey'] = 'invalid-key'
      expect(handler(event)).to.be.rejectedWith(unauthorizedError)
    })
    it('should throw an error if the API key is disabled', async () => {
      const getApiKeysErrorResponse = JSON.parse(JSON.stringify(getApiKeysResponse))
      getApiKeysErrorResponse.items![0].value = fakeUsageIdentifierKey
      getApiKeysErrorResponse.items![0].enabled = false
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysErrorResponse)
      expect(handler(event)).to.be.rejectedWith(unauthorizedError)
    })
  })
  describe('#HeaderAuthorization', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = localFixture('Event.json') as APIGatewayRequestAuthorizerEvent
      event.queryStringParameters!['ApiKey'] = fakeUsageIdentifierKey
      process.env.MultiAuthenticationPathParts = 'files'
    })
    afterEach(() => {
      sinon.restore()
    })
    it('should handle a valid Authorization header', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(localFixture('getUsagePlans.json'))
      sinon.stub(APIGateway, 'getUsage').resolves(localFixture('getUsage.json'))
      sinon.stub(SecretsManagerHelper, 'verifyAccessToken').resolves({userId: fakeUserId})
      const output = await handler(event)
      expect(output.principalId).to.equal(fakeUserId)
      expect(output.policyDocument.Statement[0].Effect).to.equal('Allow')
      expect(output.usageIdentifierKey).to.equal(fakeUsageIdentifierKey)
    })
    it('should handle an empty Authorization header', async () => {
      delete event.headers!['Authorization']
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(localFixture('getUsagePlans.json'))
      sinon.stub(APIGateway, 'getUsage').resolves(localFixture('getUsage.json'))
      sinon.stub(SecretsManagerHelper, 'verifyAccessToken').resolves({userId: fakeUserId})
      const output = await handler(event)
      expect(output.principalId).to.equal('unknown')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Deny')
      expect(output).to.be.an('object').that.does.not.have.keys('usageIdentifierKey')
    })
    it('should handle an invalid Authorization header', async () => {
      event.headers!['Authorization'] = 'invalid-header'
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(localFixture('getUsagePlans.json'))
      sinon.stub(APIGateway, 'getUsage').resolves(localFixture('getUsage.json'))
      const output = await handler(event)
      expect(output.principalId).to.equal('unknown')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Deny')
      expect(output).to.be.an('object').that.does.not.have.keys('usageIdentifierKey')
    })
    it('should handle an expired Authorization header (as multi-auth path)', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(localFixture('getUsagePlans.json'))
      sinon.stub(APIGateway, 'getUsage').resolves(localFixture('getUsage.json'))
      sinon.stub(SecretsManagerHelper, 'verifyAccessToken').throws('TokenExpiredError: jwt expired')
      event.resource = event.path = '/files'
      const output = await handler(event)
      expect(output.principalId).to.equal('unknown')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Allow')
      expect(output).to.have.all.keys('context', 'policyDocument', 'principalId', 'usageIdentifierKey')
    })
    it('should handle an expired Authorization header (as non-multi-auth path)', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(localFixture('getUsagePlans.json'))
      sinon.stub(APIGateway, 'getUsage').resolves(localFixture('getUsage.json'))
      sinon.stub(SecretsManagerHelper, 'verifyAccessToken').throws('TokenExpiredError: jwt expired')
      event.resource = event.path = '/any-path-not-multi-auth'
      const output = await handler(event)
      expect(output.principalId).to.equal('unknown')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Deny')
      expect(output).to.be.an('object').that.does.not.have.keys('usageIdentifierKey')
    })
    it('should enforce the Authentication header for multiauthentication paths', async () => {
      // if the path supports requires authentication, enforce it
      event.resource = event.path = '/userSubscribe'
      delete event.headers!['Authorization']
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(localFixture('getUsagePlans.json'))
      sinon.stub(APIGateway, 'getUsage').resolves(localFixture('getUsage.json'))
      sinon.stub(SecretsManagerHelper, 'verifyAccessToken').resolves({userId: fakeUserId})
      const output = await handler(event)
      expect(output.principalId).to.equal('unknown')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Deny')
      expect(output).to.be.an('object').that.does.not.have.keys('usageIdentifierKey')
    })
    it('should handle a test request if structured correctly', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      event.headers!['User-Agent'] = 'localhost@lifegames'
      process.env.ReservedClientIp = event.requestContext.identity.sourceIp = '127.0.0.1'
      const output = await handler(event)
      expect(output.principalId).to.equal('123e4567-e89b-12d3-a456-426614174000')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Allow')
      expect(output.usageIdentifierKey).to.equal(fakeUsageIdentifierKey)
    })
  })
  describe('#AWSFailure', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = localFixture('Event.json') as APIGatewayRequestAuthorizerEvent
      event.queryStringParameters!['ApiKey'] = fakeUsageIdentifierKey
      process.env.MultiAuthenticationPathParts = 'files'
    })
    afterEach(() => {
      sinon.restore()
    })
    it('AWS.ApiGateway.APIGatewayRequestAuthorizerEvent (not-multi-authentication)', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(localFixture('getUsagePlans.json'))
      sinon.stub(APIGateway, 'getUsage').resolves(localFixture('getUsage.json'))
      event.headers = null
      const output = await handler(event)
      expect(output.principalId).to.equal('unknown')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Deny')
      expect(output).to.be.an('object').that.does.not.have.keys('usageIdentifierKey')
    })
    it('AWS.ApiGateway.APIGatewayRequestAuthorizerEvent (multi-authentication)', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(localFixture('getUsagePlans.json'))
      sinon.stub(APIGateway, 'getUsage').resolves(localFixture('getUsage.json'))
      event.headers = null
      event.resource = event.path = '/files'
      const output = await handler(event)
      expect(output.principalId).to.equal('unknown')
      expect(output.policyDocument.Statement[0].Effect).to.equal('Allow')
      expect(output).to.have.all.keys('context', 'policyDocument', 'principalId', 'usageIdentifierKey')
    })
    it('AWS.ApiGateway.getApiKeys', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(undefined)
      expect(handler(event)).to.be.rejectedWith(UnexpectedError)
    })
    it('AWS.ApiGateway.getUsagePlans', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(undefined)
      expect(handler(event)).to.be.rejectedWith(UnexpectedError)
    })
    it('AWS.ApiGateway.getUsage', async () => {
      sinon.stub(APIGateway, 'getApiKeys').resolves(getApiKeysDefaultResponse)
      sinon.stub(APIGateway, 'getUsagePlans').resolves(localFixture('getUsagePlans.json'))
      sinon.stub(APIGateway, 'getUsage').resolves(undefined)
      expect(handler(event)).to.be.rejectedWith(UnexpectedError)
    })
  })
})
