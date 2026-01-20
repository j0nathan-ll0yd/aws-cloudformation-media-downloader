/**
 * LogoutUser Workflow Integration Tests
 *
 * Tests the session logout workflow including token validation,
 * session invalidation, and error handling.
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import type {Context} from 'aws-lambda'

// Test helpers
import {closeTestDb, createAllTables, getSessionById, getTestDbAsync, insertSession, insertUser, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockAPIGatewayProxyEvent} from '../helpers/test-data'

const {handler} = await import('#lambdas/LogoutUser/src/index')

describe('LogoutUser Workflow Integration Tests', () => {
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

  test('should invalidate valid session and return 204', async () => {
    const userId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours

    await insertUser({userId, email: 'logout@example.com', firstName: 'Logout'})
    await insertSession({id: sessionId, userId, token, expiresAt: futureExpiry})

    // Verify session is valid before logout
    const sessionBefore = await getSessionById(sessionId)
    expect(sessionBefore).not.toBeNull()
    expect(sessionBefore!.expiresAt.getTime()).toBeGreaterThan(Date.now())

    const result = await handler(createMockAPIGatewayProxyEvent({path: '/auth/logout', httpMethod: 'POST', headers: {Authorization: `Bearer ${token}`}}),
      mockContext)

    expect(result.statusCode).toBe(204)

    // Verify session was invalidated - expiresAt should be in the past
    const sessionAfter = await getSessionById(sessionId)
    expect(sessionAfter).not.toBeNull()
    expect(sessionAfter!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  test('should return 401 when Authorization header is missing', async () => {
    const result = await handler(createMockAPIGatewayProxyEvent({path: '/auth/logout', httpMethod: 'POST'}), mockContext)

    expect(result.statusCode).toBe(401)
    const response = JSON.parse(result.body)
    expect(response.error).toBeDefined()
  })

  test('should return 401 for invalid token format', async () => {
    const result = await handler(
      createMockAPIGatewayProxyEvent({path: '/auth/logout', httpMethod: 'POST', headers: {Authorization: 'invalid-token-format'}}),
      mockContext
    )

    expect(result.statusCode).toBe(401)
  })

  test('should return 401 when session is already expired', async () => {
    const userId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const expiredTime = new Date(Date.now() - 60000) // Expired 1 minute ago

    await insertUser({userId, email: 'expired@example.com'})
    await insertSession({id: sessionId, userId, token, expiresAt: expiredTime})

    const result = await handler(createMockAPIGatewayProxyEvent({path: '/auth/logout', httpMethod: 'POST', headers: {Authorization: `Bearer ${token}`}}),
      mockContext)

    expect(result.statusCode).toBe(401)
  })

  test('should return 401 when session does not exist', async () => {
    const nonExistentToken = crypto.randomUUID()

    const result = await handler(
      createMockAPIGatewayProxyEvent({path: '/auth/logout', httpMethod: 'POST', headers: {Authorization: `Bearer ${nonExistentToken}`}}),
      mockContext
    )

    expect(result.statusCode).toBe(401)
  })

  test('should invalidate session making subsequent API calls fail', async () => {
    const userId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await insertUser({userId, email: 'subsequent@example.com', firstName: 'Subsequent'})
    await insertSession({id: sessionId, userId, token, expiresAt: futureExpiry})

    // First logout should succeed
    const logoutResult = await handler(
      createMockAPIGatewayProxyEvent({path: '/auth/logout', httpMethod: 'POST', headers: {Authorization: `Bearer ${token}`}}),
      mockContext
    )
    expect(logoutResult.statusCode).toBe(204)

    // Second logout with same token should fail (session already invalidated)
    const secondResult = await handler(
      createMockAPIGatewayProxyEvent({path: '/auth/logout', httpMethod: 'POST', headers: {Authorization: `Bearer ${token}`}}),
      mockContext
    )
    expect(secondResult.statusCode).toBe(401)
  })
})
