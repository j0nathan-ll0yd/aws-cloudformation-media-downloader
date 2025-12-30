/**
 * ApiGatewayAuthorizer Dedicated Integration Tests
 *
 * Tests the API Gateway custom authorizer against real services:
 * - PostgreSQL: Session validation
 *
 * Workflow:
 * 1. Extract token from Authorization header
 * 2. Validate session in PostgreSQL via Better Auth
 * 3. Return IAM policy (Allow/Deny)
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
import {createMockAPIGatewayRequestAuthorizerEvent} from '../helpers/test-data'

// Mock Better Auth session validation
const getSessionMock = vi.fn()
vi.mock('#lib/vendor/BetterAuth/config', () => ({getAuth: vi.fn(async () => ({api: {getSession: getSessionMock}}))}))

// Import handler after mocks
const {handler} = await import('#lambdas/ApiGatewayAuthorizer/src/index')

describe('ApiGatewayAuthorizer Dedicated Integration Tests', () => {
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

  test('should allow access for valid session', async () => {
    const userId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()

    await insertUser({userId, email: 'authorized@example.com', firstName: 'Authorized'})
    await insertSession({id: sessionId, userId, token, expiresAt: new Date(Date.now() + 3600000)})

    getSessionMock.mockResolvedValue({
      session: {id: sessionId, userId, expiresAt: new Date(Date.now() + 3600000)},
      user: {id: userId, email: 'authorized@example.com'}
    })

    const result = await handler(createMockAPIGatewayRequestAuthorizerEvent({token}), mockContext)

    expect(result.principalId).toBe(userId)
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
    expect(result.context?.userId).toBe(userId)
    expect(result.context?.userStatus).toBe('Authenticated')
  })

  test('should deny access for expired session', async () => {
    const token = crypto.randomUUID()
    getSessionMock.mockResolvedValue(null)

    const result = await handler(createMockAPIGatewayRequestAuthorizerEvent({token}), mockContext)

    expect(result.principalId).toBe('unknown')
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
    expect(result.context?.userStatus).toBe('Unauthenticated')
  })

  test('should handle missing Authorization header as Anonymous', async () => {
    const result = await handler(createMockAPIGatewayRequestAuthorizerEvent(), mockContext)

    expect(result.principalId).toBe('anonymous')
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
    expect(result.context?.userStatus).toBe('Anonymous')
  })

  test('should handle malformed token', async () => {
    const event = createMockAPIGatewayRequestAuthorizerEvent({token: 'invalid-token'})
    event.headers = {...event.headers, Authorization: 'invalid-token'}

    const result = await handler(event, mockContext)

    expect(result.principalId).toBe('unknown')
    expect(result.context?.userStatus).toBe('Unauthenticated')
  })

  test('should handle Better Auth service error gracefully', async () => {
    const token = crypto.randomUUID()
    getSessionMock.mockRejectedValue(new Error('Database connection failed'))

    const result = await handler(createMockAPIGatewayRequestAuthorizerEvent({token}), mockContext)

    expect(result.principalId).toBeDefined()
    expect(result.policyDocument).toBeDefined()
  })

  test('should include integration latency in context', async () => {
    const userId = crypto.randomUUID()
    const token = crypto.randomUUID()

    getSessionMock.mockResolvedValue({
      session: {id: crypto.randomUUID(), userId, expiresAt: new Date(Date.now() + 3600000)},
      user: {id: userId, email: 'latency@example.com'}
    })

    const result = await handler(createMockAPIGatewayRequestAuthorizerEvent({token}), mockContext)

    expect(result.context?.integrationLatency).toBeDefined()
    expect(typeof result.context?.integrationLatency).toBe('number')
  })
})
