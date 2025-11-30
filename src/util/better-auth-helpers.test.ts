/**
 * Unit tests for Better Auth Helper Functions
 *
 * Tests session management, validation, and token generation using electrodb-mock.
 */

import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {UnauthorizedError} from './errors'
import {createElectroDBEntityMock} from '../../test/helpers/electrodb-mock'

// Create entity mocks
const sessionsMock = createElectroDBEntityMock({queryIndexes: ['byUser']})

// Mock Sessions entity
jest.unstable_mockModule('../entities/Sessions', () => ({Sessions: sessionsMock.entity}))

// Import after mocking
const {
  validateSessionToken,
  createUserSession,
  revokeSession,
  revokeAllUserSessions,
  refreshSession
} = await import('./better-auth-helpers')
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
  })

  describe('validateSessionToken', () => {
    it('should validate a valid session token', async () => {
      const mockSession = createMockSession()

      // Mock scan operation
      sessionsMock.mocks.scan.where.mockReturnThis()
      sessionsMock.mocks.scan.go.mockResolvedValue({data: [mockSession]})

      // Mock update operation
      sessionsMock.mocks.update.set.mockReturnThis()
      sessionsMock.mocks.update.go.mockResolvedValue({data: mockSession})

      const result = await validateSessionToken('valid-token')

      expect(result).toEqual({userId: 'user-123', sessionId: 'session-123', expiresAt: mockSession.expiresAt})

      // Should update lastActiveAt
      expect(Sessions.update).toHaveBeenCalledWith({sessionId: 'session-123'})
    })

    it('should throw UnauthorizedError for non-existent session', async () => {
      sessionsMock.mocks.scan.where.mockReturnThis()
      sessionsMock.mocks.scan.go.mockResolvedValue({data: []})

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

      sessionsMock.mocks.scan.where.mockReturnThis()
      sessionsMock.mocks.scan.go.mockResolvedValue({data: [mockSession]})

      await expect(validateSessionToken('expired-token')).rejects.toThrow(UnauthorizedError)
      await expect(validateSessionToken('expired-token')).rejects.toThrow('Session expired')
    })
  })

  describe('createUserSession', () => {
    it('should create a new session with device tracking', async () => {
      const mockSession = createMockSession({
        sessionId: 'session-new',
        token: 'new-token',
        deviceId: 'device-123',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0'
      })

      sessionsMock.mocks.create.mockResolvedValue({data: mockSession})

      const result = await createUserSession('user-123', 'device-123', '1.2.3.4', 'Mozilla/5.0')

      expect(result).toEqual({token: expect.any(String), sessionId: expect.any(String), expiresAt: expect.any(Number)})

      expect(Sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({userId: 'user-123', deviceId: 'device-123', ipAddress: '1.2.3.4', userAgent: 'Mozilla/5.0'})
      )
    })

    it('should create session without optional parameters', async () => {
      const mockSession = createMockSession({sessionId: 'session-minimal', userId: 'user-456', token: 'minimal-token'})

      sessionsMock.mocks.create.mockResolvedValue({data: mockSession})

      const result = await createUserSession('user-456')

      expect(result).toEqual({token: expect.any(String), sessionId: expect.any(String), expiresAt: expect.any(Number)})

      expect(Sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({userId: 'user-456', deviceId: undefined, ipAddress: undefined, userAgent: undefined})
      )
    })
  })

  describe('revokeSession', () => {
    it('should revoke a session by ID', async () => {
      sessionsMock.mocks.delete.mockResolvedValue(undefined)

      await revokeSession('session-123')

      expect(Sessions.delete).toHaveBeenCalledWith({sessionId: 'session-123'})
    })
  })

  describe('revokeAllUserSessions', () => {
    it('should revoke all sessions for a user', async () => {
      const mockSessions = [{sessionId: 'session-1', userId: 'user-123'}, {sessionId: 'session-2', userId: 'user-123'}, {
        sessionId: 'session-3',
        userId: 'user-123'
      }]

      // Mock query operation
      if (sessionsMock.mocks.query.byUser) {
        sessionsMock.mocks.query.byUser.go.mockResolvedValue({data: mockSessions})
      }

      // Mock delete operation
      sessionsMock.mocks.delete.mockResolvedValue(undefined)

      await revokeAllUserSessions('user-123')

      expect(Sessions.query.byUser).toHaveBeenCalledWith({userId: 'user-123'})
      expect(Sessions.delete).toHaveBeenCalledTimes(3)
      expect(Sessions.delete).toHaveBeenCalledWith({sessionId: 'session-1'})
      expect(Sessions.delete).toHaveBeenCalledWith({sessionId: 'session-2'})
      expect(Sessions.delete).toHaveBeenCalledWith({sessionId: 'session-3'})
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
      expect(sessionsMock.mocks.update.set).toHaveBeenCalledWith(
        expect.objectContaining({expiresAt: expect.any(Number), updatedAt: expect.any(Number)})
      )
    })
  })
})
