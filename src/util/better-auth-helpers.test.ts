/**
 * Unit tests for Better Auth Helper Functions
 *
 * Tests session management, validation, and token generation using electrodb-mock.
 */

import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {UnauthorizedError} from './errors'
import {createElectroDBEntityMock} from '#test/helpers/electrodb-mock'

// Create entity mocks
const sessionsMock = createElectroDBEntityMock({queryIndexes: ['byUser', 'byToken']})

// Mock Sessions entity
jest.unstable_mockModule('#entities/Sessions', () => ({Sessions: sessionsMock.entity}))

// Import after mocking
const {validateSessionToken, refreshSession} = await import('./better-auth-helpers')
const {Sessions} = await import('../entities/Sessions')

/**
 * Mock session data overrides for testing
 */
interface MockSessionOverrides {
  sessionId?: string
  userId?: string
  token?: string
  expiresAt?: number
  deviceId?: string
  ipAddress?: string
  userAgent?: string
  createdAt?: number
  updatedAt?: number
}

/**
 * Helper to create mock session objects with sensible defaults
 */
function createMockSession(overrides?: MockSessionOverrides) {
  const now = Date.now()
  return {
    sessionId: 'session-123',
    userId: 'user-123',
    token: 'valid-token',
    expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 days future
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

describe('Better Auth Helpers', () => {
  beforeEach(() => {
    // Clear all mock call history
    sessionsMock.mocks.scan.go.mockClear()
    sessionsMock.mocks.scan.where.mockClear()
    sessionsMock.mocks.create.mockClear()
    sessionsMock.mocks.update.go.mockClear()
    sessionsMock.mocks.update.set.mockClear()
    sessionsMock.mocks.delete.mockClear()
    if (sessionsMock.mocks.query.byUser) {
      sessionsMock.mocks.query.byUser.go.mockClear()
    }
    if (sessionsMock.mocks.query.byToken) {
      sessionsMock.mocks.query.byToken.go.mockClear()
    }
  })

  describe('validateSessionToken', () => {
    it('should validate a valid session token', async () => {
      const mockSession = createMockSession()

      // Mock query.byToken operation (using GSI instead of scan)
      sessionsMock.mocks.query.byToken!.go.mockResolvedValue({data: [mockSession]})

      // Mock update operation
      sessionsMock.mocks.update.set.mockReturnThis()
      sessionsMock.mocks.update.go.mockResolvedValue({data: mockSession})

      const result = await validateSessionToken('valid-token')

      expect(result).toEqual({userId: 'user-123', sessionId: 'session-123', expiresAt: mockSession.expiresAt})

      // Should update lastActiveAt
      expect(Sessions.update).toHaveBeenCalledWith({sessionId: 'session-123'})
    })

    it('should throw UnauthorizedError for non-existent session', async () => {
      sessionsMock.mocks.query.byToken!.go.mockResolvedValue({data: []})

      await expect(validateSessionToken('invalid-token')).rejects.toThrow(UnauthorizedError)
      await expect(validateSessionToken('invalid-token')).rejects.toThrow('Invalid session token')
    })

    it('should throw UnauthorizedError for expired session', async () => {
      const now = Date.now()
      const mockSession = createMockSession({
        token: 'expired-token',
        expiresAt: now - 1000, // Expired 1 second ago
        createdAt: now - 31 * 24 * 60 * 60 * 1000,
        updatedAt: now - 31 * 24 * 60 * 60 * 1000
      })

      sessionsMock.mocks.query.byToken!.go.mockResolvedValue({data: [mockSession]})

      await expect(validateSessionToken('expired-token')).rejects.toThrow(UnauthorizedError)
      await expect(validateSessionToken('expired-token')).rejects.toThrow('Session expired')
    })
  })

  describe('refreshSession', () => {
    it('should extend session expiration', async () => {
      const originalExpiration = Date.now() + 10 * 24 * 60 * 60 * 1000 // 10 days
      const newExpiration = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days

      sessionsMock.mocks.update.set.mockReturnThis()
      sessionsMock.mocks.update.go.mockResolvedValue({data: {}})

      const result = await refreshSession('session-123')

      expect(result.expiresAt).toBeGreaterThan(originalExpiration)
      expect(result.expiresAt).toBeCloseTo(newExpiration, -3)

      expect(Sessions.update).toHaveBeenCalledWith({sessionId: 'session-123'})
      expect(sessionsMock.mocks.update.set).toHaveBeenCalledWith(expect.objectContaining({expiresAt: expect.any(Number), updatedAt: expect.any(Number)}))
    })
  })
})
