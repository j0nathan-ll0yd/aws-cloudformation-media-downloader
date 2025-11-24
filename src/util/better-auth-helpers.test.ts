/**
 * Unit tests for Better Auth Helper Functions
 *
 * Tests session management, validation, and token generation using electrodb-mock.
 */

import {describe, it, expect, jest, beforeEach} from '@jest/globals'
import {
  validateSessionToken,
  createUserSession,
  revokeSession,
  revokeAllUserSessions,
  refreshSession
} from './better-auth-helpers'
import {Sessions} from '../entities/Sessions'
import {UnauthorizedError} from './errors'
import {mockElectroDBEntity} from '../../test/helpers/electrodb-mock'

// Mock Sessions entity
jest.mock('../entities/Sessions')

describe('Better Auth Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateSessionToken', () => {
    it('should validate a valid session token', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        token: 'valid-token',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days future
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // Mock scan operation
      const mockScan = {
        where: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({data: [mockSession]})
      }
      ;(Sessions.scan as any) = mockScan

      // Mock update operation
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({data: mockSession})
      }
      ;(Sessions.update as any) = jest.fn().mockReturnValue(mockUpdate)

      const result = await validateSessionToken('valid-token')

      expect(result).toEqual({
        userId: 'user-123',
        sessionId: 'session-123',
        expiresAt: mockSession.expiresAt
      })

      // Should update lastActiveAt
      expect(Sessions.update).toHaveBeenCalledWith({sessionId: 'session-123'})
    })

    it('should throw UnauthorizedError for non-existent session', async () => {
      const mockScan = {
        where: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({data: []})
      }
      ;(Sessions.scan as any) = mockScan

      await expect(validateSessionToken('invalid-token')).rejects.toThrow(UnauthorizedError)
      await expect(validateSessionToken('invalid-token')).rejects.toThrow('Invalid session token')
    })

    it('should throw UnauthorizedError for expired session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        token: 'expired-token',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        createdAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now() - 31 * 24 * 60 * 60 * 1000
      }

      const mockScan = {
        where: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({data: [mockSession]})
      }
      ;(Sessions.scan as any) = mockScan

      await expect(validateSessionToken('expired-token')).rejects.toThrow(UnauthorizedError)
      await expect(validateSessionToken('expired-token')).rejects.toThrow('Session expired')
    })
  })

  describe('createUserSession', () => {
    it('should create a new session with device tracking', async () => {
      const mockSession = {
        sessionId: 'session-new',
        userId: 'user-123',
        token: 'new-token',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        deviceId: 'device-123',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockElectroDBEntity(Sessions, 'create', mockSession)

      const result = await createUserSession('user-123', 'device-123', '1.2.3.4', 'Mozilla/5.0')

      expect(result).toEqual({
        token: expect.any(String),
        sessionId: expect.any(String),
        expiresAt: expect.any(Number)
      })

      expect(Sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          deviceId: 'device-123',
          ipAddress: '1.2.3.4',
          userAgent: 'Mozilla/5.0'
        })
      )
    })

    it('should create session without optional parameters', async () => {
      const mockSession = {
        sessionId: 'session-minimal',
        userId: 'user-456',
        token: 'minimal-token',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockElectroDBEntity(Sessions, 'create', mockSession)

      const result = await createUserSession('user-456')

      expect(result).toEqual({
        token: expect.any(String),
        sessionId: expect.any(String),
        expiresAt: expect.any(Number)
      })

      expect(Sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
          deviceId: undefined,
          ipAddress: undefined,
          userAgent: undefined
        })
      )
    })
  })

  describe('revokeSession', () => {
    it('should revoke a session by ID', async () => {
      mockElectroDBEntity(Sessions, 'delete', {})

      await revokeSession('session-123')

      expect(Sessions.delete).toHaveBeenCalledWith({sessionId: 'session-123'})
    })
  })

  describe('revokeAllUserSessions', () => {
    it('should revoke all sessions for a user', async () => {
      const mockSessions = [
        {sessionId: 'session-1', userId: 'user-123'},
        {sessionId: 'session-2', userId: 'user-123'},
        {sessionId: 'session-3', userId: 'user-123'}
      ]

      // Mock query operation
      const mockQuery = {
        byUser: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({data: mockSessions})
      }
      ;(Sessions.query as any) = mockQuery

      // Mock delete operation
      mockElectroDBEntity(Sessions, 'delete', {})

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

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({data: {}})
      }
      ;(Sessions.update as any) = jest.fn().mockReturnValue(mockUpdate)

      const result = await refreshSession('session-123')

      expect(result.expiresAt).toBeGreaterThan(originalExpiration)
      expect(result.expiresAt).toBeCloseTo(newExpiration, -3)

      expect(Sessions.update).toHaveBeenCalledWith({sessionId: 'session-123'})
      expect(mockUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Number),
          updatedAt: expect.any(Number)
        })
      )
    })
  })
})
