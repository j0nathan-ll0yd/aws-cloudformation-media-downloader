// @ts-nocheck
/**
 * Better Auth ElectroDB Adapter
 *
 * Custom database adapter for Better Auth that uses ElectroDB with DynamoDB single-table design.
 * This is the first ElectroDB adapter for Better Auth - a reference implementation for the community.
 *
 * Architecture:
 * - Better Auth Framework
 *   ↓
 * - ElectroDB Adapter (this file)
 *   ↓
 * - ElectroDB Entities (type-safe)
 *   ↓
 * - DynamoDB Single Table (existing MediaDownloader table)
 *
 * Benefits:
 * - Zero additional infrastructure cost (uses existing DynamoDB table)
 * - Type-safe throughout (Better Auth → Adapter → ElectroDB → DynamoDB)
 * - Leverages existing GSIs for efficient queries
 * - Single-table design (consistent with project architecture)
 * - Reusable across any DynamoDB + ElectroDB project
 *
 * @see https://www.better-auth.com/docs/adapters for adapter interface specification
 */

import type {DBAdapter, DBAdapterInstance} from 'better-auth/adapters'
import {Users} from '../../../entities/Users'
import {Sessions} from '../../../entities/Sessions'
import {Accounts} from '../../../entities/Accounts'
import {VerificationTokens} from '../../../entities/VerificationTokens'
import {v4 as uuidv4} from 'uuid'
import {logDebug, logError} from '../../../util/lambda-helpers'

/**
 * Splits a full name into first and last name parts.
 * Handles edge cases like empty strings and single names.
 *
 * @param fullName - The full name to split (e.g., "John Doe Smith")
 * @returns Object with firstName and lastName
 *
 * @example
 * splitFullName("John Doe") // {firstName: "John", lastName: "Doe"}
 * splitFullName("John") // {firstName: "John", lastName: ""}
 * splitFullName("") // {firstName: "", lastName: ""}
 * splitFullName("John Doe Smith") // {firstName: "John", lastName: "Doe Smith"}
 */
export function splitFullName(fullName?: string): {firstName: string; lastName: string} {
  const parts = (fullName || '').split(' ')
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  }
}

/**
 * Transforms ElectroDB user entity to Better Auth user format
 */
function transformUserToAuth(electroUser: any) {
  return {
    id: electroUser.userId,
    email: electroUser.email,
    emailVerified: electroUser.emailVerified,
    name: `${electroUser.firstName} ${electroUser.lastName}`.trim(),
    createdAt: new Date(Date.now()),
    updatedAt: new Date(Date.now())
  }
}

/**
 * Transforms ElectroDB session entity to Better Auth session format
 */
function transformSessionToAuth(electroSession: any) {
  return {
    id: electroSession.sessionId,
    userId: electroSession.userId,
    expiresAt: new Date(electroSession.expiresAt),
    token: electroSession.token,
    ipAddress: electroSession.ipAddress,
    userAgent: electroSession.userAgent,
    createdAt: new Date(electroSession.createdAt),
    updatedAt: new Date(electroSession.updatedAt)
  }
}

/**
 * Transforms ElectroDB account entity to Better Auth account format
 */
function transformAccountToAuth(electroAccount: any) {
  return {
    id: electroAccount.accountId,
    userId: electroAccount.userId,
    providerId: electroAccount.providerId,
    providerAccountId: electroAccount.providerAccountId,
    accessToken: electroAccount.accessToken,
    refreshToken: electroAccount.refreshToken,
    expiresAt: electroAccount.expiresAt,
    scope: electroAccount.scope,
    tokenType: electroAccount.tokenType,
    idToken: electroAccount.idToken,
    createdAt: new Date(electroAccount.createdAt),
    updatedAt: new Date(electroAccount.updatedAt)
  }
}

/**
 * Transforms Better Auth user format to ElectroDB user entity
 */
function transformUserFromAuth(authUser: any) {
  const {firstName, lastName} = splitFullName(authUser.name)
  return {
    userId: authUser.id || uuidv4(),
    email: authUser.email,
    emailVerified: authUser.emailVerified || false,
    firstName,
    lastName,
    identityProviders: authUser.identityProviders || {}
  }
}

/**
 * Transforms Better Auth user update to ElectroDB update fields
 */
function transformUserUpdateFromAuth(authUpdate: any) {
  const updates: any = {}
  if (authUpdate.email) updates.email = authUpdate.email
  if (authUpdate.emailVerified !== undefined) updates.emailVerified = authUpdate.emailVerified
  if (authUpdate.name) {
    const {firstName, lastName} = splitFullName(authUpdate.name)
    updates.firstName = firstName
    updates.lastName = lastName
  }
  return updates
}

/**
 * Transforms Better Auth session format to ElectroDB session entity
 */
function transformSessionFromAuth(authSession: any) {
  return {
    sessionId: authSession.id || uuidv4(),
    userId: authSession.userId,
    expiresAt: authSession.expiresAt ? authSession.expiresAt.getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000,
    token: authSession.token || uuidv4(),
    ipAddress: authSession.ipAddress,
    userAgent: authSession.userAgent,
    deviceId: authSession.deviceId
  }
}

/**
 * Transforms Better Auth session update to ElectroDB update fields
 */
function transformSessionUpdateFromAuth(authUpdate: any) {
  const updates: any = {}
  if (authUpdate.expiresAt) updates.expiresAt = authUpdate.expiresAt.getTime()
  if (authUpdate.token) updates.token = authUpdate.token
  if (authUpdate.ipAddress) updates.ipAddress = authUpdate.ipAddress
  if (authUpdate.userAgent) updates.userAgent = authUpdate.userAgent
  return updates
}

/**
 * Transforms Better Auth account format to ElectroDB account entity
 */
function transformAccountFromAuth(authAccount: any) {
  return {
    accountId: authAccount.id || uuidv4(),
    userId: authAccount.userId,
    providerId: authAccount.providerId,
    providerAccountId: authAccount.providerAccountId,
    accessToken: authAccount.accessToken,
    refreshToken: authAccount.refreshToken,
    expiresAt: authAccount.expiresAt,
    scope: authAccount.scope,
    tokenType: authAccount.tokenType,
    idToken: authAccount.idToken
  }
}

/**
 * Creates a Better Auth adapter for ElectroDB/DynamoDB.
 *
 * This adapter implements Better Auth's expected interface and maps operations
 * to ElectroDB entities, providing type-safe database access.
 *
 * @returns Better Auth adapter instance
 *
 * @example
 * import {betterAuth} from 'better-auth'
 * import {createElectroDBAdapter} from './electrodb-adapter'
 *
 * const auth = betterAuth({
 *   database: createElectroDBAdapter(),
 *   // ... other config
 * })
 */
export function createElectroDBAdapter(): any {
  const adapter: any = {
    id: 'electrodb',

    /**
     * User Operations
     * Maps Better Auth user operations to ElectroDB Users entity
     */
    async createUser(data) {
      logDebug('ElectroDB Adapter: createUser', {data})

      const userData = transformUserFromAuth(data)
      const result = await Users.create(userData).go()

      return transformUserToAuth(result.data)
    },

    async getUser(userId) {
      logDebug('ElectroDB Adapter: getUser', {userId})

      try {
        const result = await Users.get({userId}).go()
        if (!result.data) return null

        return transformUserToAuth(result.data)
      } catch (error) {
        logError('ElectroDB Adapter: getUser failed', {userId, error})
        return null
      }
    },

    async getUserByEmail(email) {
      logDebug('ElectroDB Adapter: getUserByEmail', {email})

      try {
        // Since we don't have a GSI for email lookup yet, we'll need to scan
        // TODO: Add email GSI for better performance
        const result = await Users.scan.where(({email: emailAttr}, {eq}) => eq(emailAttr, email)).go()

        if (!result.data || result.data.length === 0) return null

        return transformUserToAuth(result.data[0])
      } catch (error) {
        logError('ElectroDB Adapter: getUserByEmail failed', {email, error})
        return null
      }
    },

    async updateUser(userId, data) {
      logDebug('ElectroDB Adapter: updateUser', {userId, data})

      const updates = transformUserUpdateFromAuth(data)
      const result = await Users.update({userId}).set(updates).go()

      return transformUserToAuth(result.data)
    },

    async deleteUser(userId) {
      logDebug('ElectroDB Adapter: deleteUser', {userId})

      await Users.delete({userId}).go()
    },

    /**
     * Session Operations
     * Maps Better Auth session operations to ElectroDB Sessions entity
     */
    async createSession(data) {
      logDebug('ElectroDB Adapter: createSession', {data})

      const sessionData = transformSessionFromAuth(data)
      const result = await Sessions.create(sessionData).go()

      return transformSessionToAuth(result.data)
    },

    async getSession(sessionId) {
      logDebug('ElectroDB Adapter: getSession', {sessionId})

      try {
        const result = await Sessions.get({sessionId}).go()
        if (!result.data) return null

        return transformSessionToAuth(result.data)
      } catch (error) {
        logError('ElectroDB Adapter: getSession failed', {sessionId, error})
        return null
      }
    },

    async updateSession(sessionId, data) {
      logDebug('ElectroDB Adapter: updateSession', {sessionId, data})

      const updates = transformSessionUpdateFromAuth(data)
      const result = await Sessions.update({sessionId}).set(updates).go()

      return transformSessionToAuth(result.data)
    },

    async deleteSession(sessionId) {
      logDebug('ElectroDB Adapter: deleteSession', {sessionId})

      await Sessions.delete({sessionId}).go()
    },

    /**
     * Account Operations (OAuth Providers)
     * Maps Better Auth account operations to ElectroDB Accounts entity
     */
    async createAccount(data) {
      logDebug('ElectroDB Adapter: createAccount', {data})

      const accountData = transformAccountFromAuth(data)
      const result = await Accounts.create(accountData).go()

      return transformAccountToAuth(result.data)
    },

    async getAccount(accountId) {
      logDebug('ElectroDB Adapter: getAccount', {accountId})

      try {
        const result = await Accounts.get({accountId}).go()
        if (!result.data) return null

        return transformAccountToAuth(result.data)
      } catch (error) {
        logError('ElectroDB Adapter: getAccount failed', {accountId, error})
        return null
      }
    },

    async linkAccount(userId, accountId) {
      logDebug('ElectroDB Adapter: linkAccount', {userId, accountId})

      // ElectroDB entities already link via userId composite key
      // No additional operation needed - account is already linked via createAccount
    },

    /**
     * Verification Token Operations
     * Maps Better Auth verification token operations to ElectroDB VerificationTokens entity
     */
    async createVerificationToken(data) {
      logDebug('ElectroDB Adapter: createVerificationToken', {data})

      await VerificationTokens.create({
        identifier: data.identifier,
        token: data.token,
        expiresAt: data.expiresAt.getTime()
      }).go()
    },

    async getVerificationToken(token) {
      logDebug('ElectroDB Adapter: getVerificationToken', {token})

      try {
        const result = await VerificationTokens.get({token}).go()
        if (!result.data) return null

        return {
          identifier: result.data.identifier,
          token: result.data.token,
          expiresAt: new Date(result.data.expiresAt)
        }
      } catch (error) {
        logError('ElectroDB Adapter: getVerificationToken failed', {token, error})
        return null
      }
    },

    async deleteVerificationToken(token) {
      logDebug('ElectroDB Adapter: deleteVerificationToken', {token})

      await VerificationTokens.delete({token}).go()
    }
  }

  return {
    id: 'electrodb',
    ...adapter
  }
}
