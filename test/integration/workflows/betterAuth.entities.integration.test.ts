/**
 * Better Auth Entities Integration Tests
 *
 * Tests Better Auth ElectroDB entities (Users, Sessions, Accounts, VerificationTokens)
 * against LocalStack DynamoDB to validate:
 * - Entity CRUD operations
 * - GSI queries (byEmail, byUser, byDevice, byProvider)
 * - Collections queries (userSessions, userAccounts)
 * - Complete authentication flows
 */

import {setupLocalStackTable, cleanupLocalStackTable} from '../helpers/electrodb-localstack'
import {Users} from '../../../src/entities/Users'
import {Sessions} from '../../../src/entities/Sessions'
import {Accounts} from '../../../src/entities/Accounts'
import {VerificationTokens} from '../../../src/entities/VerificationTokens'
import {collections} from '../../../src/entities/Collections'

describe('Better Auth Entities Integration Tests', () => {
  beforeAll(async () => {
    await setupLocalStackTable()
  })

  afterAll(async () => {
    await cleanupLocalStackTable()
  })

  afterEach(async () => {
    // Clean up test data after each test
    // Note: In production, you'd want more sophisticated cleanup
  })

  describe('Users Entity', () => {
    it('should create and retrieve user by userId', async () => {
      const userData = {
        userId: 'user-test-1',
        email: 'test@example.com',
        emailVerified: true,
        firstName: 'John',
        lastName: 'Doe',
        identityProviders: {
          userId: 'apple-123',
          email: 'test@example.com',
          emailVerified: true,
          isPrivateEmail: false,
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000
        }
      }

      await Users.create(userData).go()

      const result = await Users.get({userId: 'user-test-1'}).go()

      expect(result.data).toBeDefined()
      expect(result.data?.userId).toBe('user-test-1')
      expect(result.data?.email).toBe('test@example.com')
      expect(result.data?.firstName).toBe('John')
      expect(result.data?.lastName).toBe('Doe')
      expect(result.data?.createdAt).toBeDefined()
      expect(result.data?.updatedAt).toBeDefined()
    })

    it('should query user by email using byEmail GSI', async () => {
      const userData = {
        userId: 'user-test-2',
        email: 'unique@example.com',
        emailVerified: false,
        firstName: 'Jane',
        lastName: 'Smith',
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
      }

      await Users.create(userData).go()

      const result = await Users.query.byEmail({email: 'unique@example.com'}).go()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].userId).toBe('user-test-2')
      expect(result.data[0].email).toBe('unique@example.com')
    })

    it('should return empty array for non-existent email', async () => {
      const result = await Users.query.byEmail({email: 'nonexistent@example.com'}).go()

      expect(result.data).toHaveLength(0)
    })

    it('should update user fields', async () => {
      const userData = {
        userId: 'user-test-3',
        email: 'update@example.com',
        emailVerified: false,
        firstName: 'Old',
        lastName: 'Name',
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
      }

      await Users.create(userData).go()

      await Users.update({userId: 'user-test-3'}).set({
        firstName: 'New',
        lastName: 'Updated',
        emailVerified: true
      }).go()

      const result = await Users.get({userId: 'user-test-3'}).go()

      expect(result.data?.firstName).toBe('New')
      expect(result.data?.lastName).toBe('Updated')
      expect(result.data?.emailVerified).toBe(true)
    })
  })

  describe('Sessions Entity', () => {
    it('should create and retrieve session', async () => {
      const sessionData = {
        sessionId: 'session-test-1',
        userId: 'user-session-1',
        token: 'hashed-token-123',
        expiresAt: Date.now() + 86400000,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
        deviceId: 'device-123'
      }

      await Sessions.create(sessionData).go()

      const result = await Sessions.get({sessionId: 'session-test-1'}).go()

      expect(result.data).toBeDefined()
      expect(result.data?.sessionId).toBe('session-test-1')
      expect(result.data?.userId).toBe('user-session-1')
      expect(result.data?.token).toBe('hashed-token-123')
      expect(result.data?.deviceId).toBe('device-123')
      expect(result.data?.createdAt).toBeDefined()
      expect(result.data?.updatedAt).toBeDefined()
    })

    it('should query sessions by user using byUser GSI', async () => {
      const userId = 'user-multi-session'

      await Sessions.create({
        sessionId: 'session-1',
        userId,
        token: 'token-1',
        expiresAt: Date.now() + 86400000
      }).go()

      await Sessions.create({
        sessionId: 'session-2',
        userId,
        token: 'token-2',
        expiresAt: Date.now() + 172800000
      }).go()

      await Sessions.create({
        sessionId: 'session-3',
        userId,
        token: 'token-3',
        expiresAt: Date.now() + 259200000
      }).go()

      const result = await Sessions.query.byUser({userId}).go()

      expect(result.data).toHaveLength(3)
      expect(result.data.every(s => s.userId === userId)).toBe(true)
      // Verify sorted by expiresAt (composite sort key)
      for (let i = 0; i < result.data.length - 1; i++) {
        expect(result.data[i].expiresAt).toBeLessThanOrEqual(result.data[i + 1].expiresAt)
      }
    })

    it('should query sessions by device using byDevice GSI', async () => {
      const deviceId = 'device-multi-session'

      await Sessions.create({
        sessionId: 'device-session-1',
        userId: 'user-1',
        deviceId,
        token: 'token-1',
        expiresAt: Date.now() + 86400000
      }).go()

      await Sessions.create({
        sessionId: 'device-session-2',
        userId: 'user-2',
        deviceId,
        token: 'token-2',
        expiresAt: Date.now() + 86400000
      }).go()

      const result = await Sessions.query.byDevice({deviceId}).go()

      expect(result.data).toHaveLength(2)
      expect(result.data.every(s => s.deviceId === deviceId)).toBe(true)
    })

    it('should update session expiration', async () => {
      await Sessions.create({
        sessionId: 'session-update-1',
        userId: 'user-1',
        token: 'token-1',
        expiresAt: Date.now() + 86400000
      }).go()

      const newExpiresAt = Date.now() + 172800000

      await Sessions.update({sessionId: 'session-update-1'}).set({
        expiresAt: newExpiresAt
      }).go()

      const result = await Sessions.get({sessionId: 'session-update-1'}).go()

      expect(result.data?.expiresAt).toBe(newExpiresAt)
    })

    it('should delete session', async () => {
      await Sessions.create({
        sessionId: 'session-delete-1',
        userId: 'user-1',
        token: 'token-1',
        expiresAt: Date.now() + 86400000
      }).go()

      await Sessions.delete({sessionId: 'session-delete-1'}).go()

      const result = await Sessions.get({sessionId: 'session-delete-1'}).go()

      expect(result.data).toBeUndefined()
    })
  })

  describe('Accounts Entity', () => {
    it('should create and retrieve OAuth account', async () => {
      const accountData = {
        accountId: 'account-test-1',
        userId: 'user-oauth-1',
        providerId: 'apple',
        providerAccountId: 'apple-user-123',
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: Date.now() + 3600000,
        scope: 'email name',
        tokenType: 'Bearer',
        idToken: 'id-token-123'
      }

      await Accounts.create(accountData).go()

      const result = await Accounts.get({accountId: 'account-test-1'}).go()

      expect(result.data).toBeDefined()
      expect(result.data?.accountId).toBe('account-test-1')
      expect(result.data?.providerId).toBe('apple')
      expect(result.data?.providerAccountId).toBe('apple-user-123')
      expect(result.data?.accessToken).toBe('access-token-123')
      expect(result.data?.createdAt).toBeDefined()
      expect(result.data?.updatedAt).toBeDefined()
    })

    it('should query accounts by user using byUser GSI', async () => {
      const userId = 'user-multi-provider'

      await Accounts.create({
        accountId: 'account-apple',
        userId,
        providerId: 'apple',
        providerAccountId: 'apple-123'
      }).go()

      await Accounts.create({
        accountId: 'account-google',
        userId,
        providerId: 'google',
        providerAccountId: 'google-123'
      }).go()

      const result = await Accounts.query.byUser({userId}).go()

      expect(result.data).toHaveLength(2)
      expect(result.data.map(a => a.providerId).sort()).toEqual(['apple', 'google'])
    })

    it('should query account by provider using byProvider GSI', async () => {
      await Accounts.create({
        accountId: 'account-lookup-1',
        userId: 'user-lookup-1',
        providerId: 'apple',
        providerAccountId: 'apple-unique-id'
      }).go()

      const result = await Accounts.query.byProvider({
        providerId: 'apple',
        providerAccountId: 'apple-unique-id'
      }).go()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].userId).toBe('user-lookup-1')
      expect(result.data[0].accountId).toBe('account-lookup-1')
    })
  })

  describe('VerificationTokens Entity', () => {
    it('should create and retrieve verification token', async () => {
      const tokenData = {
        token: 'verify-token-123',
        identifier: 'test@example.com',
        expiresAt: Date.now() + 3600000
      }

      await VerificationTokens.create(tokenData).go()

      const result = await VerificationTokens.get({token: 'verify-token-123'}).go()

      expect(result.data).toBeDefined()
      expect(result.data?.token).toBe('verify-token-123')
      expect(result.data?.identifier).toBe('test@example.com')
      expect(result.data?.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should delete verification token after use', async () => {
      await VerificationTokens.create({
        token: 'temp-token-123',
        identifier: 'user@example.com',
        expiresAt: Date.now() + 3600000
      }).go()

      await VerificationTokens.delete({token: 'temp-token-123'}).go()

      const result = await VerificationTokens.get({token: 'temp-token-123'}).go()

      expect(result.data).toBeUndefined()
    })
  })

  describe('Collections - Better Auth Queries', () => {
    it('should query userSessions collection', async () => {
      const userId = 'user-collection-1'

      // Create user
      await Users.create({
        userId,
        email: 'collection@example.com',
        emailVerified: true,
        firstName: 'Collection',
        lastName: 'Test',
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
      }).go()

      // Create sessions
      await Sessions.create({
        sessionId: 'coll-session-1',
        userId,
        token: 'token-1',
        expiresAt: Date.now() + 86400000
      }).go()

      await Sessions.create({
        sessionId: 'coll-session-2',
        userId,
        token: 'token-2',
        expiresAt: Date.now() + 86400000
      }).go()

      // Query collection
      const result = await collections.userSessions({userId}).go()

      expect(result.data.Users).toHaveLength(1)
      expect(result.data.Sessions).toHaveLength(2)
      expect(result.data.Users[0].userId).toBe(userId)
    })

    it('should query userAccounts collection', async () => {
      const userId = 'user-collection-2'

      // Create user
      await Users.create({
        userId,
        email: 'accounts@example.com',
        emailVerified: true,
        firstName: 'Accounts',
        lastName: 'Test',
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
      }).go()

      // Create OAuth accounts
      await Accounts.create({
        accountId: 'coll-acc-apple',
        userId,
        providerId: 'apple',
        providerAccountId: 'apple-coll-123'
      }).go()

      await Accounts.create({
        accountId: 'coll-acc-google',
        userId,
        providerId: 'google',
        providerAccountId: 'google-coll-123'
      }).go()

      // Query collection
      const result = await collections.userAccounts({userId}).go()

      expect(result.data.Users).toHaveLength(1)
      expect(result.data.Accounts).toHaveLength(2)
      expect(result.data.Accounts.map(a => a.providerId).sort()).toEqual(['apple', 'google'])
    })
  })

  describe('Complete Authentication Flow', () => {
    it('should handle complete user registration and login flow', async () => {
      const userId = 'user-complete-flow'
      const email = 'complete@example.com'

      // Step 1: Register user
      await Users.create({
        userId,
        email,
        emailVerified: false,
        firstName: 'Complete',
        lastName: 'Flow',
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
      }).go()

      // Step 2: Link OAuth account (Apple)
      await Accounts.create({
        accountId: 'flow-account-1',
        userId,
        providerId: 'apple',
        providerAccountId: 'apple-flow-123',
        accessToken: 'flow-access-token',
        refreshToken: 'flow-refresh-token',
        expiresAt: Date.now() + 3600000
      }).go()

      // Step 3: Create session
      await Sessions.create({
        sessionId: 'flow-session-1',
        userId,
        token: 'flow-session-token',
        expiresAt: Date.now() + 86400000,
        ipAddress: '192.168.1.100',
        userAgent: 'iOS App/1.0'
      }).go()

      // Verify: User can be found by email
      const userByEmail = await Users.query.byEmail({email}).go()
      expect(userByEmail.data).toHaveLength(1)
      expect(userByEmail.data[0].userId).toBe(userId)

      // Verify: Account can be found by provider
      const accountByProvider = await Accounts.query.byProvider({
        providerId: 'apple',
        providerAccountId: 'apple-flow-123'
      }).go()
      expect(accountByProvider.data).toHaveLength(1)
      expect(accountByProvider.data[0].userId).toBe(userId)

      // Verify: Sessions can be queried
      const userSessions = await Sessions.query.byUser({userId}).go()
      expect(userSessions.data).toHaveLength(1)
      expect(userSessions.data[0].token).toBe('flow-session-token')

      // Verify: Complete user resources via collection
      const userResources = await collections.userSessions({userId}).go()
      expect(userResources.data.Users).toHaveLength(1)
      expect(userResources.data.Sessions).toHaveLength(1)

      const userAccountsResult = await collections.userAccounts({userId}).go()
      expect(userAccountsResult.data.Accounts).toHaveLength(1)
    })
  })

  describe('Edge Cases', () => {
    it('should handle session expiration filtering', async () => {
      const userId = 'user-expiration-test'
      const now = Date.now()

      // Create expired session
      await Sessions.create({
        sessionId: 'expired-session',
        userId,
        token: 'expired-token',
        expiresAt: now - 1000
      }).go()

      // Create active session
      await Sessions.create({
        sessionId: 'active-session',
        userId,
        token: 'active-token',
        expiresAt: now + 86400000
      }).go()

      // Query all sessions
      const allSessions = await Sessions.query.byUser({userId}).go()

      // Filter to active only (application-level filtering)
      const activeSessions = allSessions.data.filter(s => s.expiresAt > now)

      expect(allSessions.data).toHaveLength(2)
      expect(activeSessions).toHaveLength(1)
      expect(activeSessions[0].sessionId).toBe('active-session')
    })

    it('should handle duplicate account creation gracefully', async () => {
      await Accounts.create({
        accountId: 'dup-account-1',
        userId: 'user-dup-1',
        providerId: 'apple',
        providerAccountId: 'apple-dup-123'
      }).go()

      // Attempting to create account with same accountId should fail
      await expect(
        Accounts.create({
          accountId: 'dup-account-1',
          userId: 'user-dup-2',
          providerId: 'google',
          providerAccountId: 'google-456'
        }).go()
      ).rejects.toThrow()
    })
  })
})
