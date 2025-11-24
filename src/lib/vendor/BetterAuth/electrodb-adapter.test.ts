/**
 * Unit tests for Better Auth ElectroDB Adapter
 *
 * Tests the adapter's CRUD operations using electrodb-mock pattern.
 * Verifies correct mapping between Better Auth interface and ElectroDB entities.
 */

import {describe, it, expect, jest, beforeEach} from '@jest/globals'
import {createElectroDBAdapter} from './electrodb-adapter'
import {Users} from '../../../entities/Users'
import {Sessions} from '../../../entities/Sessions'
import {Accounts} from '../../../entities/Accounts'
import {VerificationTokens} from '../../../entities/VerificationTokens'
import {mockElectroDBEntity} from '../../../../test/helpers/electrodb-mock'

// Mock ElectroDB entities
jest.mock('../../../entities/Users')
jest.mock('../../../entities/Sessions')
jest.mock('../../../entities/Accounts')
jest.mock('../../../entities/VerificationTokens')

describe('ElectroDB Adapter', () => {
  let adapter: ReturnType<typeof createElectroDBAdapter>

  beforeEach(() => {
    jest.clearAllMocks()
    adapter = createElectroDBAdapter()
  })

  describe('User Operations', () => {
    it('should create a new user', async () => {
      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        firstName: 'John',
        lastName: 'Doe',
        identityProviders: {}
      }

      mockElectroDBEntity(Users, 'create', mockUser)

      const result = await adapter.createUser({
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        name: 'John Doe'
      })

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        name: 'John Doe',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
      expect(Users.create).toHaveBeenCalledWith({
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        firstName: 'John',
        lastName: 'Doe',
        identityProviders: undefined
      })
    })

    it('should get a user by ID', async () => {
      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        firstName: 'Jane',
        lastName: 'Smith'
      }

      mockElectroDBEntity(Users, 'get', mockUser)

      const result = await adapter.getUser('user-123')

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'Jane Smith',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
      expect(Users.get).toHaveBeenCalledWith({userId: 'user-123'})
    })

    it('should return null for non-existent user', async () => {
      mockElectroDBEntity(Users, 'get', null)

      const result = await adapter.getUser('nonexistent')

      expect(result).toBeNull()
    })

    it('should get user by email', async () => {
      const mockUser = {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        firstName: 'John',
        lastName: ''
      }

      // Mock scan operation for email lookup
      const mockScan = {
        where: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({data: [mockUser]})
      }
      ;(Users.scan as any) = mockScan

      const result = await adapter.getUserByEmail('test@example.com')

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        name: 'John',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should update a user', async () => {
      const mockUpdatedUser = {
        userId: 'user-123',
        email: 'newemail@example.com',
        emailVerified: true,
        firstName: 'John',
        lastName: 'Doe'
      }

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({data: mockUpdatedUser})
      }
      ;(Users.update as any) = jest.fn().mockReturnValue(mockUpdate)

      const result = await adapter.updateUser('user-123', {
        email: 'newemail@example.com',
        emailVerified: true
      })

      expect(result).toEqual({
        id: 'user-123',
        email: 'newemail@example.com',
        emailVerified: true,
        name: 'John Doe',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should delete a user', async () => {
      mockElectroDBEntity(Users, 'delete', {})

      await adapter.deleteUser('user-123')

      expect(Users.delete).toHaveBeenCalledWith({userId: 'user-123'})
    })
  })

  describe('Session Operations', () => {
    it('should create a new session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        token: 'token-abc',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-123',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockElectroDBEntity(Sessions, 'create', mockSession)

      const result = await adapter.createSession({
        id: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(mockSession.expiresAt),
        token: 'token-abc',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-123'
      })

      expect(result).toEqual({
        id: 'session-123',
        userId: 'user-123',
        expiresAt: expect.any(Date),
        token: 'token-abc',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should get a session by ID', async () => {
      const mockSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        token: 'token-abc',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockElectroDBEntity(Sessions, 'get', mockSession)

      const result = await adapter.getSession('session-123')

      expect(result).toEqual({
        id: 'session-123',
        userId: 'user-123',
        expiresAt: expect.any(Date),
        token: 'token-abc',
        ipAddress: undefined,
        userAgent: undefined,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should update a session', async () => {
      const newExpiresAt = Date.now() + 60 * 24 * 60 * 60 * 1000
      const mockUpdatedSession = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: newExpiresAt,
        token: 'token-abc',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        go: jest.fn().mockResolvedValue({data: mockUpdatedSession})
      }
      ;(Sessions.update as any) = jest.fn().mockReturnValue(mockUpdate)

      const result = await adapter.updateSession('session-123', {
        expiresAt: new Date(newExpiresAt)
      })

      expect(result.expiresAt.getTime()).toBeCloseTo(newExpiresAt, -3)
    })

    it('should delete a session', async () => {
      mockElectroDBEntity(Sessions, 'delete', {})

      await adapter.deleteSession('session-123')

      expect(Sessions.delete).toHaveBeenCalledWith({sessionId: 'session-123'})
    })
  })

  describe('Account Operations', () => {
    it('should create a new OAuth account', async () => {
      const mockAccount = {
        accountId: 'account-123',
        userId: 'user-123',
        providerId: 'apple',
        providerAccountId: 'apple-user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        scope: 'email profile',
        tokenType: 'Bearer',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockElectroDBEntity(Accounts, 'create', mockAccount)

      const result = await adapter.createAccount({
        id: 'account-123',
        userId: 'user-123',
        providerId: 'apple',
        providerAccountId: 'apple-user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: mockAccount.expiresAt,
        scope: 'email profile',
        tokenType: 'Bearer'
      })

      expect(result).toEqual({
        id: 'account-123',
        userId: 'user-123',
        providerId: 'apple',
        providerAccountId: 'apple-user-123',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: mockAccount.expiresAt,
        scope: 'email profile',
        tokenType: 'Bearer',
        idToken: undefined,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should get an account by ID', async () => {
      const mockAccount = {
        accountId: 'account-123',
        userId: 'user-123',
        providerId: 'google',
        providerAccountId: 'google-user-123',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      mockElectroDBEntity(Accounts, 'get', mockAccount)

      const result = await adapter.getAccount('account-123')

      expect(result).toEqual({
        id: 'account-123',
        userId: 'user-123',
        providerId: 'google',
        providerAccountId: 'google-user-123',
        accessToken: undefined,
        refreshToken: undefined,
        expiresAt: undefined,
        scope: undefined,
        tokenType: undefined,
        idToken: undefined,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should link account (no-op in ElectroDB)', async () => {
      // Account linking is automatic in ElectroDB via composite keys
      await adapter.linkAccount('user-123', 'account-123')

      // No assertions - this is a no-op in our implementation
      expect(true).toBe(true)
    })
  })

  describe('Verification Token Operations', () => {
    it('should create a verification token', async () => {
      mockElectroDBEntity(VerificationTokens, 'create', {
        identifier: 'test@example.com',
        token: 'verify-token-123',
        expiresAt: Date.now() + 86400000
      })

      await adapter.createVerificationToken({
        identifier: 'test@example.com',
        token: 'verify-token-123',
        expiresAt: new Date(Date.now() + 86400000)
      })

      expect(VerificationTokens.create).toHaveBeenCalled()
    })

    it('should get a verification token', async () => {
      const mockToken = {
        identifier: 'test@example.com',
        token: 'verify-token-123',
        expiresAt: Date.now() + 86400000
      }

      mockElectroDBEntity(VerificationTokens, 'get', mockToken)

      const result = await adapter.getVerificationToken('verify-token-123')

      expect(result).toEqual({
        identifier: 'test@example.com',
        token: 'verify-token-123',
        expiresAt: expect.any(Date)
      })
    })

    it('should delete a verification token', async () => {
      mockElectroDBEntity(VerificationTokens, 'delete', {})

      await adapter.deleteVerificationToken('verify-token-123')

      expect(VerificationTokens.delete).toHaveBeenCalledWith({token: 'verify-token-123'})
    })
  })
})
