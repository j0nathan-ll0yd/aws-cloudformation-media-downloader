import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {APIGatewayRequestAuthorizerEvent} from 'aws-lambda'
import * as crypto from 'crypto'
import {v4 as uuidv4} from 'uuid'
import {UnexpectedError} from '#lib/system/errors'
import {testContext} from '#util/vitest-setup'
import type {SessionPayload} from '#types/util'
const fakeUserId = uuidv4()
const fakeUsageIdentifierKey = crypto.randomBytes(48).toString('hex')
const unauthorizedError = new Error('Unauthorized')

const getApiKeysMock = vi.fn()
const getUsagePlansMock = vi.fn()
const getUsageMock = vi.fn()
const {default: getUsagePlansResponse} = await import('./fixtures/getUsagePlans.json', {assert: {type: 'json'}})
const {default: getUsageResponse} = await import('./fixtures/getUsage.json', {assert: {type: 'json'}})
vi.mock('#lib/vendor/AWS/ApiGateway', () => ({
  getApiKeys: getApiKeysMock, // fmt: multiline
  getUsagePlans: getUsagePlansMock,
  getUsage: getUsageMock
}))

// Setup variations of the getApiKeys response
const {default: getApiKeysResponse} = await import('./fixtures/getApiKeys.json', {assert: {type: 'json'}})
const getApiKeysDefaultResponse = JSON.parse(JSON.stringify(getApiKeysResponse))
getApiKeysDefaultResponse.items![0].value = fakeUsageIdentifierKey

const {default: eventMock} = await import('./fixtures/Event.json', {assert: {type: 'json'}})

const validateSessionTokenMock = vi.fn<(token: string) => Promise<SessionPayload>>()
vi.mock('#lib/domain/auth/session-service', () => ({validateSessionToken: validateSessionTokenMock}))

const {handler} = await import('./../src')

describe('#APIGatewayAuthorizer', () => {
  const successResponseKeys = ['context', 'policyDocument', 'principalId', 'usageIdentifierKey']
  const failureResponseKeys = ['context', 'policyDocument', 'principalId']
  describe('#HeaderApiKey', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = JSON.parse(JSON.stringify(eventMock))
      event.queryStringParameters!['ApiKey'] = fakeUsageIdentifierKey
      process.env.MULTI_AUTHENTICATION_PATH_PARTS = 'files'
    })
    test('should throw an error if there is no API key', async () => {
      delete event.queryStringParameters!['ApiKey']
      await expect(handler(event, testContext)).rejects.toThrow(unauthorizedError)
    })
    test('should throw an error if the API key is invalid', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      event.queryStringParameters!['ApiKey'] = 'invalid-key'
      await expect(handler(event, testContext)).rejects.toThrow(unauthorizedError)
    })
    test('should throw an error if the API key is disabled', async () => {
      const getApiKeysErrorResponse = JSON.parse(JSON.stringify(getApiKeysResponse))
      getApiKeysErrorResponse.items![0].value = fakeUsageIdentifierKey
      getApiKeysErrorResponse.items![0].enabled = false
      getApiKeysMock.mockReturnValue(getApiKeysErrorResponse)
      await expect(handler(event, testContext)).rejects.toThrow(unauthorizedError)
    })
  })
  describe('#HeaderAuthorization', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = JSON.parse(JSON.stringify(eventMock))
      event.queryStringParameters!['ApiKey'] = fakeUsageIdentifierKey
      process.env.MULTI_AUTHENTICATION_PATH_PARTS = 'files'
      validateSessionTokenMock.mockReset()
    })
    test('should handle a valid Authorization header', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: 'session-123', expiresAt: Date.now() + 3600000})
      const output = await handler(event, testContext)
      expect(output.principalId).toEqual(fakeUserId)
      expect(output.policyDocument.Statement[0].Effect).toEqual('Allow')
      expect(output.usageIdentifierKey).toEqual(fakeUsageIdentifierKey)
    })
    test('should handle an empty Authorization header', async () => {
      delete event.headers!['Authorization']
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: 'session-123', expiresAt: Date.now() + 3600000})
      const output = await handler(event, testContext)
      expect(output.principalId).toEqual('unknown')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Deny')
      expect(Object.keys(output)).toEqual(expect.arrayContaining(failureResponseKeys))
    })
    test('should handle an invalid Authorization header', async () => {
      event.headers!['Authorization'] = 'invalid-header'
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      const output = await handler(event, testContext)
      expect(output.principalId).toEqual('unknown')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Deny')
      expect(Object.keys(output)).toEqual(expect.arrayContaining(failureResponseKeys))
    })
    test('should handle an expired Authorization header (as multi-auth path)', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockRejectedValue(new Error('Session expired'))
      event.resource = event.path = '/files'
      const output = await handler(event, testContext)
      expect(output.principalId).toEqual('unknown')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Allow')
      expect(Object.keys(output)).toEqual(expect.arrayContaining(successResponseKeys))
    })
    test('should handle an expired Authorization header (as non-multi-auth path)', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockRejectedValue(new Error('Session expired'))
      event.resource = event.path = '/any-path-not-multi-auth'
      const output = await handler(event, testContext)
      expect(output.principalId).toEqual('unknown')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Deny')
      expect(Object.keys(output)).toEqual(expect.arrayContaining(failureResponseKeys))
    })
    test('should enforce the Authentication header for multiauthentication paths', async () => {
      // if the path supports requires authentication, enforce it
      event.resource = event.path = '/userSubscribe'
      delete event.headers!['Authorization']
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: 'session-123', expiresAt: Date.now() + 3600000})
      const output = await handler(event, testContext)
      expect(output.principalId).toEqual('unknown')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Deny')
      expect(Object.keys(output)).toEqual(expect.arrayContaining(failureResponseKeys))
    })
    test('should handle a test request if structured correctly', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      event.headers!['User-Agent'] = 'localhost@lifegames'
      process.env.RESERVED_CLIENT_IP = event.requestContext.identity.sourceIp = '127.0.0.1'
      const output = await handler(event, testContext)
      expect(output.principalId).toEqual('123e4567-e89b-12d3-a456-426614174000')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Allow')
      expect(output.usageIdentifierKey).toEqual(fakeUsageIdentifierKey)
    })
  })
  describe('#AWSFailure', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = JSON.parse(JSON.stringify(eventMock))
      event.queryStringParameters!['ApiKey'] = fakeUsageIdentifierKey
      process.env.MULTI_AUTHENTICATION_PATH_PARTS = 'files'
    })
    test('should deny access when headers are missing on non-multi-auth path', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      event.headers = null
      const output = await handler(event, testContext)
      expect(output.principalId).toEqual('unknown')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Deny')
      expect(Object.keys(output)).toEqual(expect.arrayContaining(failureResponseKeys))
    })
    test('should allow access when headers are missing on multi-auth path', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      event.headers = null
      event.resource = event.path = '/files'
      const output = await handler(event, testContext)
      expect(output.principalId).toEqual('unknown')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Allow')
      expect(Object.keys(output)).toEqual(expect.arrayContaining(successResponseKeys))
    })
    test('should throw error when API key retrieval fails', async () => {
      getApiKeysMock.mockReturnValue(undefined)
      await expect(handler(event, testContext)).rejects.toThrow(UnexpectedError)
    })
    test('should throw error when usage plan retrieval fails', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(undefined)
      await expect(handler(event, testContext)).rejects.toThrow(UnexpectedError)
    })
    test('should throw error when usage retrieval fails', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(undefined)
      await expect(handler(event, testContext)).rejects.toThrow(UnexpectedError)
    })
  })
})
