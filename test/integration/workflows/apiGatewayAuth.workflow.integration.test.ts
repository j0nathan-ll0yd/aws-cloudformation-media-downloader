/**
 * ApiGatewayAuthorizer Workflow Integration Tests
 *
 * Tests the session token validation:
 * - Session service: Mocked for session lookup
 * - API Gateway SDK: Mocked for key validation
 *
 * Workflow:
 * 1. Extract token from Authorization header
 * 2. Validate session via session service (mocked)
 * 3. Return IAM policy with userId principal
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.MULTI_AUTHENTICATION_PATH_PARTS = 'files'

import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest'
import type {APIGatewayRequestAuthorizerEvent} from 'aws-lambda'
import {createMockContext} from '#util/vitest-setup'

// Mock API Gateway vendor calls - must use vi.hoisted for ESM
const {mockGetApiKeys, mockGetUsagePlans, mockGetUsage} = vi.hoisted(() => ({mockGetApiKeys: vi.fn(), mockGetUsagePlans: vi.fn(), mockGetUsage: vi.fn()}))

vi.mock('#lib/vendor/AWS/ApiGateway', () => ({getApiKeys: mockGetApiKeys, getUsagePlans: mockGetUsagePlans, getUsage: mockGetUsage}))

// Mock session service - must use vi.hoisted for ESM
const {validateSessionTokenMock} = vi.hoisted(() => ({validateSessionTokenMock: vi.fn()}))
vi.mock('#lib/domain/auth/session-service', () => ({validateSessionToken: validateSessionTokenMock}))

// Import handler after mocks are set up
const {handler} = await import('#lambdas/ApiGatewayAuthorizer/src/index')

const TEST_API_KEY = 'test-api-key-12345'
const TEST_API_KEY_ID = 'test-key-id'
const TEST_USAGE_PLAN_ID = 'test-usage-plan'

function createAuthorizerEvent(overrides: Partial<APIGatewayRequestAuthorizerEvent> = {}): APIGatewayRequestAuthorizerEvent {
  return {
    type: 'REQUEST',
    methodArn: 'arn:aws:execute-api:us-west-2:123456789012:api-id/stage/GET/resource',
    resource: '/resource',
    path: '/resource',
    httpMethod: 'GET',
    headers: {Authorization: 'Bearer valid-session-token', 'User-Agent': 'iOS/17.0 TestApp/1.0'},
    multiValueHeaders: {},
    pathParameters: null,
    queryStringParameters: {ApiKey: TEST_API_KEY},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: undefined,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/resource',
      stage: 'test',
      requestId: `test-${Date.now()}`,
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/resource',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'iOS/17.0 TestApp/1.0',
        userArn: null
      }
    },
    ...overrides
  }
}

const context = createMockContext({functionName: 'ApiGatewayAuthorizer'})

function setupApiGatewayMocks() {
  mockGetApiKeys.mockResolvedValue({items: [{id: TEST_API_KEY_ID, value: TEST_API_KEY, enabled: true}]})
  mockGetUsagePlans.mockResolvedValue({items: [{id: TEST_USAGE_PLAN_ID}]})
  mockGetUsage.mockResolvedValue({items: {[TEST_API_KEY_ID]: [[0, 100]]}})
}

describe('ApiGatewayAuthorizer Workflow Integration Tests', () => {
  beforeAll(() => {
    // No database setup needed - we're mocking everything
  })

  beforeEach(() => {
    vi.clearAllMocks()
    setupApiGatewayMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Session token validation', () => {
    test('should Allow when session token is valid and not expired', async () => {
      // Arrange: Mock valid session
      const userId = crypto.randomUUID()
      const sessionToken = 'valid-session-token-abc123'
      const oneHourFromNow = Date.now() + 60 * 60 * 1000

      validateSessionTokenMock.mockResolvedValue({sessionId: crypto.randomUUID(), userId, expiresAt: oneHourFromNow})

      // Act
      const event = createAuthorizerEvent({headers: {Authorization: `Bearer ${sessionToken}`, 'User-Agent': 'iOS/17.0'}})
      const result = await handler(event, context)

      // Assert: Allow policy with userId as principalId
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.principalId).toBe(userId)
      expect(result.usageIdentifierKey).toBe(TEST_API_KEY)
      expect(validateSessionTokenMock).toHaveBeenCalledWith(sessionToken)
    })

    test('should throw Unauthorized when session token does not exist in database', async () => {
      // Arrange: Mock session not found
      validateSessionTokenMock.mockRejectedValue(new Error('Session not found'))

      // Act & Assert: Should throw Unauthorized for invalid token on protected path
      const event = createAuthorizerEvent({headers: {Authorization: 'Bearer nonexistent-token', 'User-Agent': 'iOS/17.0'}})
      await expect(handler(event, context)).rejects.toThrow('Unauthorized')
    })

    test('should throw Unauthorized when session token is expired', async () => {
      // Arrange: Mock expired session
      validateSessionTokenMock.mockRejectedValue(new Error('Session expired'))

      // Act & Assert: Should throw Unauthorized for expired token on protected path
      const event = createAuthorizerEvent({headers: {Authorization: 'Bearer expired-session-token', 'User-Agent': 'iOS/17.0'}})
      await expect(handler(event, context)).rejects.toThrow('Unauthorized')
    })

    test('should validate specific session token', async () => {
      // Arrange: User with valid session
      const userId = crypto.randomUUID()
      const sessionToken = 'specific-session-token'
      const oneHourFromNow = Date.now() + 60 * 60 * 1000

      validateSessionTokenMock.mockResolvedValue({sessionId: crypto.randomUUID(), userId, expiresAt: oneHourFromNow})

      // Act
      const event = createAuthorizerEvent({headers: {Authorization: `Bearer ${sessionToken}`, 'User-Agent': 'iOS/17.0'}})
      const result = await handler(event, context)

      // Assert: Correct session validated
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.principalId).toBe(userId)
      expect(validateSessionTokenMock).toHaveBeenCalledWith(sessionToken)
    })
  })

  describe('Multi-authentication paths', () => {
    test('should Allow multi-auth path without Authorization header', async () => {
      // Arrange: No auth header, but path is in MULTI_AUTHENTICATION_PATH_PARTS
      const event = createAuthorizerEvent({
        path: '/files',
        resource: '/files',
        headers: {'User-Agent': 'iOS/17.0'} // No Authorization header
      })

      // Act
      const result = await handler(event, context)

      // Assert: Allow with unknown principal (multi-auth path doesn't require auth)
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.principalId).toBe('unknown')
    })

    test('should Allow multi-auth path with invalid token (fallback to anonymous)', async () => {
      // Arrange: Invalid token on multi-auth path
      validateSessionTokenMock.mockRejectedValue(new Error('Session not found'))

      const event = createAuthorizerEvent({path: '/files', resource: '/files', headers: {Authorization: 'Bearer invalid-token', 'User-Agent': 'iOS/17.0'}})

      // Act
      const result = await handler(event, context)

      // Assert: Allow with unknown principal (multi-auth path allows anonymous)
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.principalId).toBe('unknown')
    })

    test('should throw Unauthorized on non-multi-auth path without Authorization header', async () => {
      // Arrange: No auth header on protected path
      const event = createAuthorizerEvent({
        path: '/protected',
        resource: '/protected',
        headers: {'User-Agent': 'iOS/17.0'} // No Authorization header
      })

      // Act & Assert: Should throw Unauthorized (protected path requires auth)
      await expect(handler(event, context)).rejects.toThrow('Unauthorized')
    })
  })

  describe('Token format validation', () => {
    test('should throw Unauthorized for malformed Authorization header (not Bearer format)', async () => {
      // Arrange: Auth header without Bearer prefix
      const event = createAuthorizerEvent({headers: {Authorization: 'Basic invalid-format', 'User-Agent': 'iOS/17.0'}})

      // Act & Assert: Should throw Unauthorized (invalid header format on protected path)
      await expect(handler(event, context)).rejects.toThrow('Unauthorized')
    })

    test('should handle valid session with complex token format', async () => {
      // Arrange: Session with JWT-like token (contains dots and hyphens)
      const userId = crypto.randomUUID()
      const sessionToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const oneHourFromNow = Date.now() + 60 * 60 * 1000

      validateSessionTokenMock.mockResolvedValue({sessionId: crypto.randomUUID(), userId, expiresAt: oneHourFromNow})

      // Act
      const event = createAuthorizerEvent({headers: {Authorization: `Bearer ${sessionToken}`, 'User-Agent': 'iOS/17.0'}})
      const result = await handler(event, context)

      // Assert: Allow with userId
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.principalId).toBe(userId)
    })
  })

  describe('Multiple sessions per user', () => {
    test('should validate specific token when user has multiple sessions', async () => {
      // Arrange: Mock session validation for specific token
      const userId = crypto.randomUUID()
      const token2 = 'session-token-2'
      const oneHourFromNow = Date.now() + 60 * 60 * 1000

      validateSessionTokenMock.mockResolvedValue({sessionId: crypto.randomUUID(), userId, expiresAt: oneHourFromNow})

      // Act: Validate using token2
      const event = createAuthorizerEvent({headers: {Authorization: `Bearer ${token2}`, 'User-Agent': 'iOS/17.0'}})
      const result = await handler(event, context)

      // Assert: Correct session validated
      expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
      expect(result.principalId).toBe(userId)
      expect(validateSessionTokenMock).toHaveBeenCalledWith(token2)
    })
  })
})
