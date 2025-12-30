/**
 * RefreshToken Workflow Integration Tests
 *
 * Tests session refresh workflow:
 * 1. Extract Bearer token from Authorization header
 * 2. Validate session exists in PostgreSQL
 * 3. Check session not expired
 * 4. Extend session expiration
 *
 * Uses real PostgreSQL for sessions.
 *
 * @see src/lambdas/RefreshToken/src/index.ts
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import type {APIGatewayProxyEvent} from 'aws-lambda'

// Test helpers
import {closeTestDb, createAllTables, dropAllTables, getSessionById, insertSession, insertUser, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'

// Import handler after environment setup
const {handler} = await import('#lambdas/RefreshToken/src/index')

/**
 * Creates an API Gateway event for RefreshToken testing
 */
function createRefreshTokenEvent(token?: string): APIGatewayProxyEvent {
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return {
    httpMethod: 'POST',
    path: '/auth/refresh',
    headers,
    body: null,
    isBase64Encoded: false,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    multiValueHeaders: {},
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {},
      httpMethod: 'POST',
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
        userAgent: 'test-agent',
        userArn: null
      },
      path: '/auth/refresh',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/auth/refresh',
      stage: 'test'
    },
    resource: '/auth/refresh'
  }
}

// Skip in CI: Handler uses own Drizzle connection that doesn't respect worker schema isolation
describe.skipIf(Boolean(process.env.CI))('RefreshToken Workflow Integration Tests', () => {
  beforeAll(async () => {
    // Create PostgreSQL tables
    await createAllTables()
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Drop tables and close connection
    await dropAllTables()
    await closeTestDb()
  })

  describe('Valid Session Refresh', () => {
    test('should refresh valid session token', async () => {
      // Arrange: Create user and valid session
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `valid-token-${Date.now()}`
      const originalExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

      await insertUser({userId, email: 'refresh@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt: originalExpiresAt})

      // Act: Invoke handler
      const event = createRefreshTokenEvent(token)
      const result = await handler(event, createMockContext())

      // Assert: Success response with refreshed token
      expect(result.statusCode).toBe(200)

      const body = JSON.parse(result.body)
      expect(body.body.token).toBe(token)
      expect(body.body.sessionId).toBe(sessionId)
      expect(body.body.userId).toBe(userId)
      expect(body.body.expiresAt).toBeGreaterThan(originalExpiresAt.getTime())
    })

    test('should update session updatedAt timestamp', async () => {
      // Arrange: Create session with old updatedAt
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `update-token-${Date.now()}`
      const oldUpdatedAt = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await insertUser({userId, email: 'update@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt, updatedAt: oldUpdatedAt})

      // Act: Invoke handler
      const event = createRefreshTokenEvent(token)
      await handler(event, createMockContext())

      // Assert: Session updatedAt should be recent
      const session = await getSessionById(sessionId)
      expect(session).not.toBeNull()
      expect(session!.updatedAt.getTime()).toBeGreaterThan(oldUpdatedAt.getTime())
    })

    test('should extend expiresAt by configured duration', async () => {
      // Arrange: Create session close to expiration
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `extend-token-${Date.now()}`
      const nearExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

      await insertUser({userId, email: 'extend@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt: nearExpiresAt})

      // Act: Invoke handler
      const event = createRefreshTokenEvent(token)
      const result = await handler(event, createMockContext())

      // Assert: Expiration extended significantly (30 days by default)
      const body = JSON.parse(result.body)
      const newExpiresAt = body.body.expiresAt

      // New expiration should be at least 29 days from now
      const minExpectedExpiration = Date.now() + 29 * 24 * 60 * 60 * 1000
      expect(newExpiresAt).toBeGreaterThan(minExpectedExpiration)
    })
  })

  describe('Invalid Session Handling', () => {
    test('should reject expired session token', async () => {
      // Arrange: Create expired session
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `expired-token-${Date.now()}`
      const expiredAt = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago

      await insertUser({userId, email: 'expired@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt: expiredAt})

      // Act: Invoke handler
      const event = createRefreshTokenEvent(token)
      const result = await handler(event, createMockContext())

      // Assert: Unauthorized response
      expect(result.statusCode).toBe(401)
    })

    test('should reject nonexistent session token', async () => {
      // Arrange: No session in database
      const token = 'nonexistent-token'

      // Act: Invoke handler
      const event = createRefreshTokenEvent(token)
      const result = await handler(event, createMockContext())

      // Assert: Unauthorized response
      expect(result.statusCode).toBe(401)
    })

    test('should reject missing Authorization header', async () => {
      // Arrange: Event without Authorization header
      const event = createRefreshTokenEvent() // No token

      // Act: Invoke handler
      const result = await handler(event, createMockContext())

      // Assert: Unauthorized response
      expect(result.statusCode).toBe(401)
    })

    test('should reject invalid Authorization header format', async () => {
      // Arrange: Invalid Authorization format (no "Bearer " prefix)
      const event = createRefreshTokenEvent('invalid-format')
      event.headers['Authorization'] = 'Basic some-token' // Wrong format

      // Act: Invoke handler
      const result = await handler(event, createMockContext())

      // Assert: Unauthorized response
      expect(result.statusCode).toBe(401)
    })
  })

  describe('Edge Cases', () => {
    test('should handle lowercase authorization header', async () => {
      // Arrange: Create valid session
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `lowercase-token-${Date.now()}`
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await insertUser({userId, email: 'lowercase@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt})

      // Act: Use lowercase 'authorization' header
      const event = createRefreshTokenEvent('')
      delete event.headers['Authorization']
      event.headers['authorization'] = `Bearer ${token}`

      const result = await handler(event, createMockContext())

      // Assert: Should work with lowercase header
      expect(result.statusCode).toBe(200)
    })

    test('should preserve session after multiple refreshes', async () => {
      // Arrange: Create session
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `multi-refresh-token-${Date.now()}`
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await insertUser({userId, email: 'multi@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt})

      // Act: Refresh multiple times
      const event = createRefreshTokenEvent(token)
      await handler(event, createMockContext())
      await handler(event, createMockContext())
      const result = await handler(event, createMockContext())

      // Assert: Still valid after multiple refreshes
      expect(result.statusCode).toBe(200)

      const body = JSON.parse(result.body)
      expect(body.body.sessionId).toBe(sessionId)
    })
  })
})
