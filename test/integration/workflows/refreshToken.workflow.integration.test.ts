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

// Test helpers
import {closeTestDb, getSessionById, insertSession, insertUser, truncateAllTables} from '../helpers/postgres-helpers'
import {createMockContext} from '../helpers/lambda-context'
import {createMockAPIGatewayEvent} from '../helpers/test-data'

// Import handler after environment setup
const {handler} = await import('#lambdas/RefreshToken/src/index')

// Skip in CI: Handler uses own Drizzle connection that doesn't respect worker schema isolation
describe.skipIf(Boolean(process.env.CI))('RefreshToken Workflow Integration Tests', () => {
  beforeAll(async () => {
    // No setup needed - tables created by globalSetup
  })

  afterEach(async () => {
    // Clean up data between tests
    await truncateAllTables()
  })

  afterAll(async () => {
    // Close database connection
    await closeTestDb()
  })

  describe('Valid Session Refresh', () => {
    test('should refresh valid session token', async () => {
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `valid-token-${Date.now()}`
      const originalExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

      await insertUser({userId, email: 'refresh@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt: originalExpiresAt})

      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/auth/refresh', headers: {Authorization: `Bearer ${token}`}})
      const result = await handler(event, createMockContext())

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.body.token).toBe(token)
      expect(body.body.sessionId).toBe(sessionId)
      expect(body.body.userId).toBe(userId)
      expect(body.body.expiresAt).toBeGreaterThan(originalExpiresAt.getTime())
    })

    test('should update session updatedAt timestamp', async () => {
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `update-token-${Date.now()}`
      const oldUpdatedAt = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await insertUser({userId, email: 'update@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt, updatedAt: oldUpdatedAt})

      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/auth/refresh', headers: {Authorization: `Bearer ${token}`}})
      await handler(event, createMockContext())

      const session = await getSessionById(sessionId)
      expect(session).not.toBeNull()
      expect(session!.updatedAt.getTime()).toBeGreaterThan(oldUpdatedAt.getTime())
    })

    test('should extend expiresAt by configured duration', async () => {
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `extend-token-${Date.now()}`
      const nearExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

      await insertUser({userId, email: 'extend@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt: nearExpiresAt})

      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/auth/refresh', headers: {Authorization: `Bearer ${token}`}})
      const result = await handler(event, createMockContext())

      const body = JSON.parse(result.body)
      const newExpiresAt = body.body.expiresAt

      // New expiration should be at least 29 days from now
      const minExpectedExpiration = Date.now() + 29 * 24 * 60 * 60 * 1000
      expect(newExpiresAt).toBeGreaterThan(minExpectedExpiration)
    })
  })

  describe('Invalid Session Handling', () => {
    test('should reject expired session token', async () => {
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `expired-token-${Date.now()}`
      const expiredAt = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago

      await insertUser({userId, email: 'expired@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt: expiredAt})

      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/auth/refresh', headers: {Authorization: `Bearer ${token}`}})
      const result = await handler(event, createMockContext())

      expect(result.statusCode).toBe(401)
    })

    test('should reject nonexistent session token', async () => {
      const token = 'nonexistent-token'

      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/auth/refresh', headers: {Authorization: `Bearer ${token}`}})
      const result = await handler(event, createMockContext())

      expect(result.statusCode).toBe(401)
    })

    test('should reject missing Authorization header', async () => {
      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/auth/refresh'})

      const result = await handler(event, createMockContext())

      expect(result.statusCode).toBe(401)
    })

    test('should reject invalid Authorization header format', async () => {
      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/auth/refresh', headers: {Authorization: 'Basic some-token'}})

      const result = await handler(event, createMockContext())

      expect(result.statusCode).toBe(401)
    })
  })

  describe('Edge Cases', () => {
    test('should handle lowercase authorization header', async () => {
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `lowercase-token-${Date.now()}`
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await insertUser({userId, email: 'lowercase@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt})

      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/auth/refresh', headers: {authorization: `Bearer ${token}`}})

      const result = await handler(event, createMockContext())

      expect(result.statusCode).toBe(200)
    })

    test('should preserve session after multiple refreshes', async () => {
      const userId = crypto.randomUUID()
      const sessionId = crypto.randomUUID()
      const token = `multi-refresh-token-${Date.now()}`
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await insertUser({userId, email: 'multi@example.com'})
      await insertSession({id: sessionId, userId, token, expiresAt})

      const event = createMockAPIGatewayEvent({httpMethod: 'POST', path: '/auth/refresh', headers: {Authorization: `Bearer ${token}`}})
      await handler(event, createMockContext())
      await handler(event, createMockContext())
      const result = await handler(event, createMockContext())

      expect(result.statusCode).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.body.sessionId).toBe(sessionId)
    })
  })
})
