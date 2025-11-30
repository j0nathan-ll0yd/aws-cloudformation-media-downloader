/**
 * Unit tests for Better Auth ElectroDB Adapter
 *
 * Tests the adapter's CRUD operations using electrodb-mock pattern.
 * Verifies correct mapping between Better Auth interface and ElectroDB entities.
 */

import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'
import {createMockAccount, createMockSession, createMockUser} from '../../../../test/helpers/better-auth-test-data'
import type {ExtendedAccount} from './electrodb-adapter'

// Create entity mocks
const usersMock = createElectroDBEntityMock({queryIndexes: ['byEmail']})
const sessionsMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
const accountsMock = createElectroDBEntityMock({queryIndexes: ['byUser']})
const verificationTokensMock = createElectroDBEntityMock()

// Mock ElectroDB entities
jest.unstable_mockModule('../../../entities/Users', () => ({Users: usersMock.entity}))
jest.unstable_mockModule('../../../entities/Sessions', () => ({Sessions: sessionsMock.entity}))
jest.unstable_mockModule('../../../entities/Accounts', () => ({Accounts: accountsMock.entity}))
jest.unstable_mockModule('../../../entities/VerificationTokens', () => ({VerificationTokens: verificationTokensMock.entity}))

// Import adapter after mocking
const {createElectroDBAdapter} = await import('./electrodb-adapter')
const {Users} = await import('../../../entities/Users')
const {Sessions} = await import('../../../entities/Sessions')
const {VerificationTokens} = await import('../../../entities/VerificationTokens')

// Type for createAccount test data - matches adapter's createAccount signature
type CreateAccountInput = Partial<ExtendedAccount> & {id?: string}

describe('ElectroDB Adapter', () => {
  let adapter: ReturnType<typeof createElectroDBAdapter>

  beforeEach(() => {
    // Clear all mock call history
    usersMock.mocks.create.mockClear()
    usersMock.mocks.get.mockClear()
    usersMock.mocks.update.go.mockClear()
    usersMock.mocks.update.set.mockClear()
    usersMock.mocks.delete.mockClear()
    sessionsMock.mocks.create.mockClear()
    sessionsMock.mocks.get.mockClear()
    sessionsMock.mocks.update.go.mockClear()
    sessionsMock.mocks.update.set.mockClear()
    sessionsMock.mocks.delete.mockClear()
    accountsMock.mocks.create.mockClear()
    accountsMock.mocks.get.mockClear()
    verificationTokensMock.mocks.create.mockClear()
    verificationTokensMock.mocks.get.mockClear()
    verificationTokensMock.mocks.delete.mockClear()
    adapter = createElectroDBAdapter()
  })

  describe('User Operations', () => {
    it('should create a new user', async () => {
      const mockUser = createMockUser()

      usersMock.mocks.create.mockResolvedValue({data: mockUser})

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
        identityProviders: {
          userId: '',
          email: '',
          emailVerified: false,
          isPrivateEmail: false,
          accessToken: '',
          refreshToken: '',
          tokenType: '',
          expiresAt: 0
        }
      })
    })

    it('should get a user by ID', async () => {
      const mockUser = createMockUser({emailVerified: true, firstName: 'Jane', lastName: 'Smith'})

      usersMock.mocks.get.mockResolvedValue({data: mockUser})

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
      usersMock.mocks.get.mockResolvedValue(undefined)

      const result = await adapter.getUser('nonexistent')

      expect(result).toBeNull()
    })

    it('should get user by email', async () => {
      const mockUser = createMockUser({emailVerified: true, lastName: ''})

      // Mock query.byEmail operation for efficient email lookup
      usersMock.mocks.query.byEmail!.go.mockResolvedValue({data: [mockUser]})

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
      const mockUpdatedUser = createMockUser({email: 'newemail@example.com', emailVerified: true})

      usersMock.mocks.update.set.mockReturnThis()
      usersMock.mocks.update.go.mockResolvedValue({data: mockUpdatedUser})

      const result = await adapter.updateUser('user-123', {email: 'newemail@example.com', emailVerified: true})

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
      usersMock.mocks.delete.mockResolvedValue(undefined)

      await adapter.deleteUser('user-123')

      expect(Users.delete).toHaveBeenCalledWith({userId: 'user-123'})
    })
  })

  describe('Session Operations', () => {
    it('should create a new session', async () => {
      const mockSession = createMockSession()

      sessionsMock.mocks.create.mockResolvedValue({data: mockSession})

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
      const mockSession = createMockSession({ipAddress: undefined, userAgent: undefined, deviceId: undefined})

      sessionsMock.mocks.get.mockResolvedValue({data: mockSession})

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
      const mockUpdatedSession = createMockSession({expiresAt: newExpiresAt})

      sessionsMock.mocks.update.set.mockReturnThis()
      sessionsMock.mocks.update.go.mockResolvedValue({data: mockUpdatedSession})

      const result = await adapter.updateSession('session-123', {expiresAt: new Date(newExpiresAt)})

      expect(result.expiresAt.getTime()).toBeCloseTo(newExpiresAt, -3)
    })

    it('should delete a session', async () => {
      sessionsMock.mocks.delete.mockResolvedValue(undefined)

      await adapter.deleteSession('session-123')

      expect(Sessions.delete).toHaveBeenCalledWith({sessionId: 'session-123'})
    })
  })

  describe('Account Operations', () => {
    it('should create a new OAuth account', async () => {
      const mockAccount = createMockAccount()

      accountsMock.mocks.create.mockResolvedValue({data: mockAccount})

      const result = await adapter.createAccount({
        id: 'account-123',
        userId: 'user-123',
        providerId: 'apple',
        accountId: 'apple-user-123', // Better Auth uses 'accountId'
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: mockAccount.expiresAt,
        scope: 'email profile',
        tokenType: 'Bearer'
      } as CreateAccountInput)

      expect(result).toEqual({
        id: 'account-123',
        userId: 'user-123',
        accountId: 'apple-user-123', // Better Auth uses 'accountId'
        providerId: 'apple',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: mockAccount.expiresAt,
        scope: 'email profile',
        tokenType: 'Bearer',
        idToken: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    })

    it('should get an account by ID', async () => {
      const mockAccount = createMockAccount({
        providerId: 'google',
        providerAccountId: 'google-user-123',
        accessToken: undefined,
        refreshToken: undefined,
        expiresAt: undefined,
        scope: undefined,
        tokenType: undefined
      })

      accountsMock.mocks.get.mockResolvedValue({data: mockAccount})

      const result = await adapter.getAccount('account-123')

      expect(result).toEqual({
        id: 'account-123',
        userId: 'user-123',
        accountId: 'google-user-123', // Better Auth uses 'accountId'
        providerId: 'google',
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        scope: null,
        tokenType: null,
        idToken: null,
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
      verificationTokensMock.mocks.create.mockResolvedValue({
        data: {identifier: 'test@example.com', token: 'verify-token-123', expiresAt: Date.now() + 86400000}
      })

      await adapter.createVerificationToken({
        identifier: 'test@example.com',
        token: 'verify-token-123',
        expiresAt: new Date(Date.now() + 86400000)
      })

      expect(VerificationTokens.create).toHaveBeenCalled()
    })

    it('should get a verification token', async () => {
      const mockToken = {identifier: 'test@example.com', token: 'verify-token-123', expiresAt: Date.now() + 86400000}

      verificationTokensMock.mocks.get.mockResolvedValue({data: mockToken})

      const result = await adapter.getVerificationToken('verify-token-123')

      expect(result).toEqual({identifier: 'test@example.com', token: 'verify-token-123', expiresAt: expect.any(Date)})
    })

    it('should delete a verification token', async () => {
      verificationTokensMock.mocks.delete.mockResolvedValue(undefined)

      await adapter.deleteVerificationToken('verify-token-123')

      expect(VerificationTokens.delete).toHaveBeenCalledWith({token: 'verify-token-123'})
    })
  })
})
