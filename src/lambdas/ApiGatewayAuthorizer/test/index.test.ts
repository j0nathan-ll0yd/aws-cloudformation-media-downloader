import {beforeEach, describe, expect, test, vi} from 'vitest'
import type {APIGatewayRequestAuthorizerEvent} from 'aws-lambda'
import {randomBytes} from 'node:crypto'
import {UnexpectedError} from '#lib/system/errors'
import {createMockContext} from '#util/vitest-setup'
import {createApiGatewayAuthorizerEvent} from '#test/helpers/event-factories'
import {createGetApiKeysResponse, createGetUsagePlansResponse, createGetUsageResponse} from '#test/helpers/aws-response-factories'
import {DEFAULT_USER_ID} from '#test/helpers/entity-fixtures'
import type {SessionPayload} from '#types/util'

const fakeUserId = DEFAULT_USER_ID
const fakeUsageIdentifierKey = randomBytes(48).toString('hex')
const unauthorizedError = new Error('Unauthorized')

const getApiKeysMock = vi.fn()
const getUsagePlansMock = vi.fn()
const getUsageMock = vi.fn()
vi.mock('#lib/vendor/AWS/ApiGateway', () => ({
  getApiKeys: getApiKeysMock, // fmt: multiline
  getUsagePlans: getUsagePlansMock,
  getUsage: getUsageMock
}))

// Setup API Gateway mock responses using factories
const getApiKeysDefaultResponse = createGetApiKeysResponse({value: fakeUsageIdentifierKey})
const getUsagePlansResponse = createGetUsagePlansResponse()
const getUsageResponse = createGetUsageResponse()

const validateSessionTokenMock = vi.fn<(token: string) => Promise<SessionPayload>>()
vi.mock('#lib/domain/auth/sessionService', () => ({validateSessionToken: validateSessionTokenMock}))

const {handler} = await import('./../src')

describe('#APIGatewayAuthorizer', () => {
  const successResponseKeys = ['context', 'policyDocument', 'principalId', 'usageIdentifierKey']

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('#HeaderApiKey', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = createApiGatewayAuthorizerEvent({queryStringParameters: {ApiKey: fakeUsageIdentifierKey}})
      process.env.MULTI_AUTHENTICATION_PATH_PARTS = 'files'
    })
    test('should throw an error if there is no API key', async () => {
      delete event.queryStringParameters!['ApiKey']
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })
    test('should throw an error if the API key is invalid', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      event.queryStringParameters!['ApiKey'] = 'invalid-key'
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })
    test('should throw an error if the API key is disabled', async () => {
      const getApiKeysDisabledResponse = createGetApiKeysResponse({value: fakeUsageIdentifierKey, enabled: false})
      getApiKeysMock.mockReturnValue(getApiKeysDisabledResponse)
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })
  })
  describe('#HeaderAuthorization', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = createApiGatewayAuthorizerEvent({queryStringParameters: {ApiKey: fakeUsageIdentifierKey}, headers: {Authorization: 'Bearer test-token'}})
      process.env.MULTI_AUTHENTICATION_PATH_PARTS = 'files'
    })
    test('should handle a valid Authorization header', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockResolvedValue({userId: fakeUserId, sessionId: 'session-123', expiresAt: Date.now() + 3600000})
      const output = await handler(event, createMockContext())
      expect(output.principalId).toEqual(fakeUserId)
      expect(output.policyDocument.Statement[0].Effect).toEqual('Allow')
      expect(output.usageIdentifierKey).toEqual(fakeUsageIdentifierKey)
    })
    test('should return 401 for missing Authorization header on protected path', async () => {
      delete event.headers!['Authorization']
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })
    test('should return 401 for invalid Authorization header format', async () => {
      event.headers!['Authorization'] = 'invalid-header'
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })
    test('should handle an expired Authorization header (as multi-auth path)', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockRejectedValue(new Error('Session expired'))
      event.resource = event.path = '/files'
      const output = await handler(event, createMockContext())
      expect(output.principalId).toEqual('unknown')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Allow')
      expect(Object.keys(output)).toEqual(expect.arrayContaining(successResponseKeys))
    })
    test('should return 401 for expired session on protected path', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockRejectedValue(new Error('Session expired'))
      event.resource = event.path = '/any-path-not-multi-auth'
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })
    test('should return 401 for missing Authorization header on protected path (userSubscribe)', async () => {
      event.resource = event.path = '/userSubscribe'
      delete event.headers!['Authorization']
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })
  })
  describe('#AWSFailure', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = createApiGatewayAuthorizerEvent({queryStringParameters: {ApiKey: fakeUsageIdentifierKey}, headers: {Authorization: 'Bearer test-token'}})
      process.env.MULTI_AUTHENTICATION_PATH_PARTS = 'files'
    })
    test('should return 401 when headers are missing on non-multi-auth path', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      event.headers = null
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })
    test('should allow access when headers are missing on multi-auth path', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      event.headers = null
      event.resource = event.path = '/files'
      const output = await handler(event, createMockContext())
      expect(output.principalId).toEqual('unknown')
      expect(output.policyDocument.Statement[0].Effect).toEqual('Allow')
      expect(Object.keys(output)).toEqual(expect.arrayContaining(successResponseKeys))
    })
    test('should throw error when API key retrieval fails', async () => {
      getApiKeysMock.mockReturnValue(undefined)
      await expect(handler(event, createMockContext())).rejects.toThrow(UnexpectedError)
    })
    test('should throw error when usage plan retrieval fails', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(undefined)
      await expect(handler(event, createMockContext())).rejects.toThrow(UnexpectedError)
    })
    test('should throw error when usage retrieval fails', async () => {
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(undefined)
      await expect(handler(event, createMockContext())).rejects.toThrow(UnexpectedError)
    })
  })

  describe('#EdgeCases', () => {
    let event: APIGatewayRequestAuthorizerEvent
    beforeEach(() => {
      event = createApiGatewayAuthorizerEvent({queryStringParameters: {ApiKey: fakeUsageIdentifierKey}, headers: {Authorization: 'Bearer test-token'}})
      process.env.MULTI_AUTHENTICATION_PATH_PARTS = 'files'
    })

    test('should handle session validation timeout', async () => {
      const timeoutError = new Error('Session validation timeout')
      Object.assign(timeoutError, {code: 'ETIMEDOUT'})
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockRejectedValue(timeoutError)
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })

    test('should handle API key with special characters', async () => {
      const specialKey = 'key+with/special=chars'
      event.queryStringParameters!['ApiKey'] = specialKey
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })

    test('should handle very long authorization token', async () => {
      const longToken = 'Bearer ' + 'a'.repeat(10000)
      event.headers!['Authorization'] = longToken
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      validateSessionTokenMock.mockRejectedValue(new Error('Invalid token'))
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })

    test('should handle empty Bearer token', async () => {
      event.headers!['Authorization'] = 'Bearer '
      getApiKeysMock.mockReturnValue(getApiKeysDefaultResponse)
      getUsagePlansMock.mockReturnValue(getUsagePlansResponse)
      getUsageMock.mockReturnValue(getUsageResponse)
      // Empty token should be rejected during validation
      await expect(handler(event, createMockContext())).rejects.toThrow(unauthorizedError)
    })
  })
})
