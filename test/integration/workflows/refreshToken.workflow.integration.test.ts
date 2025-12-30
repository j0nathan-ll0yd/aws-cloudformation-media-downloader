/**
 * RefreshToken Workflow Integration Tests
 *
 * Tests the session refresh workflow against real services:
 * - PostgreSQL: Session records for validation and refresh
 *
 * Workflow:
 * 1. Extract session token from Authorization header
 * 2. Validate session exists and is not expired
 * 3. Extend session expiration
 * 4. Return updated session info
 */

// Set environment variables before imports
process.env.USE_LOCALSTACK = 'true'
process.env.AWS_REGION = 'us-west-2'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://test:test@localhost:5432/media_downloader_test'

import {afterAll, afterEach, beforeAll, describe, expect, test, vi} from 'vitest'
import type {Context} from 'aws-lambda'

// Test helpers
import {closeTestDb, createAllTables, dropAllTables, insertSession, insertUser, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockAPIGatewayProxyEvent} from '../helpers/test-data'

// Mock the session service since it has complex dependencies
vi.mock('#lib/domain/auth/session-service', () => ({validateSessionToken: vi.fn(), refreshSession: vi.fn()}))

// Import after mocks
const {handler} = await import('#lambdas/RefreshToken/src/index')
import {refreshSession, validateSessionToken} from '#lib/domain/auth/session-service'
import {UnauthorizedError} from '#lib/system/errors'

describe('RefreshToken Workflow Integration Tests', () => {
  let mockContext: Context

  beforeAll(async () => {
    await createAllTables()
    mockContext = createMockContext()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await truncateAllTables()
  })

  afterAll(async () => {
    await dropAllTables()
    await closeTestDb()
  })

  test('should successfully refresh a valid session', async () => {
    const userId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const newExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000

    await insertUser({userId, email: 'refresh@example.com', firstName: 'Refresh'})
    await insertSession({id: sessionId, userId, token, expiresAt: new Date(Date.now() + 60000)})

    vi.mocked(validateSessionToken).mockResolvedValue({sessionId, userId, expiresAt: Date.now() + 60000})
    vi.mocked(refreshSession).mockResolvedValue({expiresAt: newExpiresAt})

    const result = await handler(createMockAPIGatewayProxyEvent({path: '/auth/refresh', httpMethod: 'POST', headers: {Authorization: `Bearer ${token}`}}),
      mockContext)

    expect(result.statusCode).toBe(200)
    const response = JSON.parse(result.body)
    expect(response.body.token).toBe(token)
    expect(response.body.sessionId).toBe(sessionId)
    expect(response.body.userId).toBe(userId)
    expect(response.body.expiresAt).toBe(newExpiresAt)
  })

  test('should return 401 when Authorization header is missing', async () => {
    const result = await handler(createMockAPIGatewayProxyEvent({path: '/auth/refresh', httpMethod: 'POST'}), mockContext)

    expect(result.statusCode).toBe(401)
    const response = JSON.parse(result.body)
    expect(response.error).toBeDefined()
  })

  test('should return 401 for invalid token format', async () => {
    const result = await handler(
      createMockAPIGatewayProxyEvent({path: '/auth/refresh', httpMethod: 'POST', headers: {Authorization: 'invalid-token-format'}}),
      mockContext
    )

    expect(result.statusCode).toBe(401)
  })

  test('should return 401 when session is expired', async () => {
    const token = crypto.randomUUID()
    vi.mocked(validateSessionToken).mockRejectedValue(new UnauthorizedError('Session expired'))

    const result = await handler(createMockAPIGatewayProxyEvent({path: '/auth/refresh', httpMethod: 'POST', headers: {Authorization: `Bearer ${token}`}}),
      mockContext)

    expect(result.statusCode).toBe(401)
  })

  test('should return 401 when session does not exist', async () => {
    const token = crypto.randomUUID()
    vi.mocked(validateSessionToken).mockRejectedValue(new UnauthorizedError('Session not found'))

    const result = await handler(createMockAPIGatewayProxyEvent({path: '/auth/refresh', httpMethod: 'POST', headers: {Authorization: `Bearer ${token}`}}),
      mockContext)

    expect(result.statusCode).toBe(401)
  })
})
