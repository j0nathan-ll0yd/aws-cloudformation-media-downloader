/**
 * RefreshToken Workflow Integration Tests
 *
 * Tests the session refresh workflow with REAL PostgreSQL:
 * - Session service uses real entity queries via getDrizzleClient()
 * - Session validation and refresh against real database
 *
 * Workflow:
 * 1. Extract session token from Authorization header
 * 2. Validate session exists and is not expired (real DB query)
 * 3. Extend session expiration (real DB update)
 * 4. Return updated session info
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import type {Context} from 'aws-lambda'

// Test helpers
import {
  closeTestDb,
  createAllTables,
  getSessionById,
  getTestDbAsync,
  insertSession,
  insertUser,
  truncateAllTables
} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockAPIGatewayProxyEvent} from '../helpers/test-data'

// Import handler - uses real session-service which uses real entity queries
const {handler} = await import('#lambdas/RefreshToken/src/index')

describe('RefreshToken Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await getTestDbAsync()
    await createAllTables()
    mockContext = createMockContext()
  })

  afterEach(async () => {
    await truncateAllTables()
  })

  afterAll(async () => {
    await closeTestDb()
  })

  test('should successfully refresh a valid session', async () => {
    // Arrange: Create user and session in real database
    const userId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const originalExpiry = new Date(Date.now() + 60000) // Expires in 1 minute

    await insertUser({userId, email: 'refresh@example.com', firstName: 'Refresh'})
    await insertSession({id: sessionId, userId, token, expiresAt: originalExpiry})

    // Act
    const result = await handler(
      createMockAPIGatewayProxyEvent({
        path: '/auth/refresh',
        httpMethod: 'POST',
        headers: {Authorization: `Bearer ${token}`}
      }),
      mockContext
    )

    // Assert
    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.token).toBe(token)
    expect(response.body.sessionId).toBe(sessionId)
    expect(response.body.userId).toBe(userId)

    // Verify expiration was extended (should be ~30 days from now)
    const thirtyDaysFromNow = Date.now() + 29 * 24 * 60 * 60 * 1000 // 29 days minimum
    expect(response.body.expiresAt).toBeGreaterThan(thirtyDaysFromNow)

    // Verify database was updated
    const updatedSession = await getSessionById(sessionId)
    expect(updatedSession).not.toBeNull()
    expect(updatedSession!.expiresAt.getTime()).toBeGreaterThan(thirtyDaysFromNow)
  })

  test('should return 401 when Authorization header is missing', async () => {
    const result = await handler(
      createMockAPIGatewayProxyEvent({path: '/auth/refresh', httpMethod: 'POST'}),
      mockContext
    )

    expect(result.statusCode).toBe(401)
    const response = JSON.parse(result.body)
    expect(response.error).toBeDefined()
  })

  test('should return 401 for invalid token format', async () => {
    const result = await handler(
      createMockAPIGatewayProxyEvent({
        path: '/auth/refresh',
        httpMethod: 'POST',
        headers: {Authorization: 'invalid-token-format'}
      }),
      mockContext
    )

    expect(result.statusCode).toBe(401)
  })

  test('should return 401 when session is expired', async () => {
    // Arrange: Create expired session
    const userId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const expiredTime = new Date(Date.now() - 60000) // Expired 1 minute ago

    await insertUser({userId, email: 'expired@example.com'})
    await insertSession({id: sessionId, userId, token, expiresAt: expiredTime})

    // Act
    const result = await handler(
      createMockAPIGatewayProxyEvent({
        path: '/auth/refresh',
        httpMethod: 'POST',
        headers: {Authorization: `Bearer ${token}`}
      }),
      mockContext
    )

    // Assert
    expect(result.statusCode).toBe(401)
  })

  test('should return 401 when session does not exist', async () => {
    const nonExistentToken = crypto.randomUUID()

    const result = await handler(
      createMockAPIGatewayProxyEvent({
        path: '/auth/refresh',
        httpMethod: 'POST',
        headers: {Authorization: `Bearer ${nonExistentToken}`}
      }),
      mockContext
    )

    expect(result.statusCode).toBe(401)
  })
})
