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

import type {Account, Session, User} from 'better-auth'
import type {EntityItem} from 'electrodb'
import {Users} from '#entities/Users'
import {Sessions} from '#entities/Sessions'
import {Accounts} from '#entities/Accounts'
import {VerificationTokens} from '#entities/VerificationTokens'
import {v4 as uuidv4} from 'uuid'
import {logDebug, logError} from '#util/lambda-helpers'

/**
 * ElectroDB entity response types - what we get back from database queries
 * ElectroDB's EntityItem doesn't include auto-generated fields, so we extend it
 */
type ElectroUserItem = EntityItem<typeof Users> & {createdAt?: number; updatedAt?: number}

type ElectroSessionItem = EntityItem<typeof Sessions> & {createdAt: number; updatedAt: number}

type ElectroAccountItem = EntityItem<typeof Accounts> & {createdAt: number; updatedAt: number}

/**
 * Identity provider data structure (from Sign in with Apple)
 * This matches the ElectroDB schema for the identityProviders map field
 */
type IdentityProvidersData = {
  userId: string
  email: string
  emailVerified: boolean
  isPrivateEmail: boolean
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresAt: number
}

/**
 * ElectroDB create types - what we send to database creates
 * Required fields must be present, optional fields can be omitted
 */
type ElectroUserCreate = {
  userId: string
  email: string
  emailVerified: boolean
  firstName: string
  lastName: string
  identityProviders: IdentityProvidersData // ElectroDB requires all fields
}

type ElectroSessionCreate = {
  sessionId: string
  userId: string
  expiresAt: number
  token: string
  ipAddress?: string
  userAgent?: string
  deviceId?: string
}

type ElectroAccountCreate = {
  accountId: string
  userId: string
  providerId: string
  providerAccountId: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  scope?: string
  tokenType?: string
  idToken?: string
}

/**
 * ElectroDB update types - partial updates for set() operations
 * Only include fields that can be updated
 */
type ElectroUserUpdate = Partial<
  Pick<ElectroUserCreate, 'email' | 'emailVerified' | 'firstName' | 'lastName'>
>
type ElectroSessionUpdate = Partial<
  Pick<ElectroSessionCreate, 'expiresAt' | 'token' | 'ipAddress' | 'userAgent'>
>

/**
 * Extended Account type that includes OAuth token metadata we store in ElectroDB
 * Better Auth's base Account type doesn't include these fields, but we persist them
 */
export type ExtendedAccount = Account & {scope?: string | null; tokenType?: string | null; expiresAt?: number | null}

/**
 * Splits a full name into first and last name parts.
 * Handles edge cases like empty strings and single names.
 *
 * @param fullName - The full name to split (e.g., "John Doe Smith")
 * @returns Object with firstName and lastName
 *
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/ElectroDB-Adapter-Design#name-splitting-utility | Name Splitting Examples}
 */
export function splitFullName(fullName?: string): {firstName: string; lastName: string} {
  const parts = (fullName || '').split(' ')
  return {firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || ''}
}

/**
 * Transforms ElectroDB user entity to Better Auth user format
 * Accepts partial data from update operations
 */
function transformUserToAuth(electroUser: Partial<ElectroUserItem>): User {
  return {
    id: electroUser.userId!,
    email: electroUser.email!,
    emailVerified: electroUser.emailVerified ?? false,
    name: `${electroUser.firstName ?? ''} ${electroUser.lastName ?? ''}`.trim(),
    createdAt: new Date(electroUser.createdAt ?? Date.now()),
    updatedAt: new Date(electroUser.updatedAt ?? Date.now())
  }
}

/**
 * Transforms ElectroDB session entity to Better Auth session format
 * Accepts partial data from update operations
 */
function transformSessionToAuth(electroSession: Partial<ElectroSessionItem>): Session {
  return {
    id: electroSession.sessionId!,
    userId: electroSession.userId!,
    expiresAt: new Date(electroSession.expiresAt!),
    token: electroSession.token!,
    ipAddress: electroSession.ipAddress ?? undefined,
    userAgent: electroSession.userAgent ?? undefined,
    createdAt: new Date(electroSession.createdAt ?? Date.now()),
    updatedAt: new Date(electroSession.updatedAt ?? Date.now())
  }
}

/**
 * Transforms ElectroDB account entity to Better Auth account format
 * Returns ExtendedAccount which includes OAuth metadata we persist
 */
function transformAccountToAuth(electroAccount: ElectroAccountItem): ExtendedAccount {
  return {
    id: electroAccount.accountId,
    userId: electroAccount.userId,
    accountId: electroAccount.providerAccountId, // Better Auth uses 'accountId', we store as 'providerAccountId'
    providerId: electroAccount.providerId,
    accessToken: electroAccount.accessToken ?? null,
    refreshToken: electroAccount.refreshToken ?? null,
    idToken: electroAccount.idToken ?? null,
    scope: electroAccount.scope ?? null,
    tokenType: electroAccount.tokenType ?? null,
    expiresAt: electroAccount.expiresAt ?? null,
    createdAt: new Date(electroAccount.createdAt),
    updatedAt: new Date(electroAccount.updatedAt)
  }
}

/**
 * Transforms Better Auth user format to ElectroDB user create data
 */
function transformUserFromAuth(authUser: Partial<User> & {id?: string}): ElectroUserCreate {
  const {firstName, lastName} = splitFullName(authUser.name)
  // ElectroDB requires all fields in identityProviders map, so we provide defaults
  const identityProviders: IdentityProvidersData = {
    userId: '',
    email: '',
    emailVerified: false,
    isPrivateEmail: false,
    accessToken: '',
    refreshToken: '',
    tokenType: '',
    expiresAt: 0
  }

  return {
    userId: authUser.id || uuidv4(),
    email: authUser.email!, // Required by Better Auth
    emailVerified: authUser.emailVerified ?? false,
    firstName,
    lastName,
    identityProviders // Provide complete object with required fields
  }
}

/**
 * Transforms Better Auth user update to ElectroDB update fields
 */
function transformUserUpdateFromAuth(authUpdate: Partial<User>): ElectroUserUpdate {
  const updates: ElectroUserUpdate = {}
  if (authUpdate.email) {
    updates.email = authUpdate.email
  }
  if (authUpdate.emailVerified !== undefined) {
    updates.emailVerified = authUpdate.emailVerified
  }
  if (authUpdate.name) {
    const {firstName, lastName} = splitFullName(authUpdate.name)
    updates.firstName = firstName
    updates.lastName = lastName
  }
  return updates
}

/**
 * Transforms Better Auth session format to ElectroDB session create data
 * Converts null to undefined for ElectroDB compatibility
 * Note: deviceId is conditionally included to support sparse GSI indexing
 */
function transformSessionFromAuth(authSession: Partial<Session> & {id?: string; deviceId?: string}): ElectroSessionCreate {
  const result: ElectroSessionCreate = {
    sessionId: authSession.id || uuidv4(),
    userId: authSession.userId!, // Required by Better Auth
    expiresAt: authSession.expiresAt
      ? authSession.expiresAt.getTime()
      : Date.now() + 30 * 24 * 60 * 60 * 1000,
    token: authSession.token || uuidv4(),
    ipAddress: authSession.ipAddress ?? undefined,
    userAgent: authSession.userAgent ?? undefined
  }
  // Only include deviceId if provided - enables sparse GSI indexing
  if (authSession.deviceId) {
    result.deviceId = authSession.deviceId
  }
  return result
}

/**
 * Transforms Better Auth session update to ElectroDB update fields
 * Converts null to undefined for ElectroDB compatibility
 */
function transformSessionUpdateFromAuth(authUpdate: Partial<Session>): ElectroSessionUpdate {
  const updates: ElectroSessionUpdate = {}
  if (authUpdate.expiresAt) {
    updates.expiresAt = authUpdate.expiresAt.getTime()
  }
  if (authUpdate.token) {
    updates.token = authUpdate.token
  }
  if (authUpdate.ipAddress !== undefined && authUpdate.ipAddress !== null) {
    updates.ipAddress = authUpdate.ipAddress
  }
  if (authUpdate.userAgent !== undefined && authUpdate.userAgent !== null) {
    updates.userAgent = authUpdate.userAgent
  }
  return updates
}

/**
 * Transforms Better Auth account format to ElectroDB account create data
 * Note: Better Auth passes 'accountId' field, we store as 'providerAccountId'
 */
function transformAccountFromAuth(authAccount: Partial<ExtendedAccount> & {id?: string}): ElectroAccountCreate {
  return {
    accountId: authAccount.id || uuidv4(),
    userId: authAccount.userId!, // Required by Better Auth
    providerId: authAccount.providerId!, // Required by Better Auth
    providerAccountId: authAccount.accountId || '', // Better Auth uses 'accountId', we store as 'providerAccountId'
    accessToken: authAccount.accessToken ?? undefined,
    refreshToken: authAccount.refreshToken ?? undefined,
    expiresAt: authAccount.expiresAt ?? undefined,
    scope: authAccount.scope ?? undefined,
    tokenType: authAccount.tokenType ?? undefined,
    idToken: authAccount.idToken ?? undefined
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
 * @see {@link https://github.com/j0nathan-ll0yd/aws-cloudformation-media-downloader/wiki/ElectroDB-Adapter-Design#adapter-interface | ElectroDB Adapter Usage}
 */
export function createElectroDBAdapter() {
  const adapter = {
    id: 'electrodb',

    /**
     * User Operations
     * Maps Better Auth user operations to ElectroDB Users entity
     */
    async createUser(data: Partial<User> & {id?: string}): Promise<User> {
      logDebug('ElectroDB Adapter: createUser', {data})

      const userData = transformUserFromAuth(data)
      const result = await Users.create(userData).go()

      return transformUserToAuth(result.data)
    },

    async getUser(userId: string): Promise<User | null> {
      logDebug('ElectroDB Adapter: getUser', {userId})

      try {
        const result = await Users.get({userId}).go()
        if (!result.data) {
          return null
        }

        return transformUserToAuth(result.data)
      } catch (error) {
        logError('ElectroDB Adapter: getUser failed', {userId, error})
        return null
      }
    },

    async getUserByEmail(email: string): Promise<User | null> {
      logDebug('ElectroDB Adapter: getUserByEmail', {email})

      try {
        // Use byEmail GSI for efficient lookup
        const result = await Users.query.byEmail({email}).go()

        if (!result.data || result.data.length === 0) {
          return null
        }

        return transformUserToAuth(result.data[0])
      } catch (error) {
        logError('ElectroDB Adapter: getUserByEmail failed', {email, error})
        return null
      }
    },

    async updateUser(userId: string, data: Partial<User>): Promise<User> {
      logDebug('ElectroDB Adapter: updateUser', {userId, data})

      const updates = transformUserUpdateFromAuth(data)
      const result = await Users.update({userId}).set(updates).go()

      return transformUserToAuth(result.data)
    },

    async deleteUser(userId: string): Promise<void> {
      logDebug('ElectroDB Adapter: deleteUser', {userId})

      await Users.delete({userId}).go()
    },

    /**
     * Session Operations
     * Maps Better Auth session operations to ElectroDB Sessions entity
     */
    async createSession(data: Partial<Session> & {id?: string; deviceId?: string}): Promise<Session> {
      logDebug('ElectroDB Adapter: createSession', {data})

      const sessionData = transformSessionFromAuth(data)
      const result = await Sessions.create(sessionData).go()

      return transformSessionToAuth(result.data)
    },

    async getSession(sessionId: string): Promise<Session | null> {
      logDebug('ElectroDB Adapter: getSession', {sessionId})

      try {
        const result = await Sessions.get({sessionId}).go()
        if (!result.data) {
          return null
        }

        return transformSessionToAuth(result.data)
      } catch (error) {
        logError('ElectroDB Adapter: getSession failed', {sessionId, error})
        return null
      }
    },

    async updateSession(sessionId: string, data: Partial<Session>): Promise<Session> {
      logDebug('ElectroDB Adapter: updateSession', {sessionId, data})

      const updates = transformSessionUpdateFromAuth(data)
      const result = await Sessions.update({sessionId}).set(updates).go()

      return transformSessionToAuth(result.data)
    },

    async deleteSession(sessionId: string): Promise<void> {
      logDebug('ElectroDB Adapter: deleteSession', {sessionId})

      await Sessions.delete({sessionId}).go()
    },

    /**
     * Account Operations (OAuth Providers)
     * Maps Better Auth account operations to ElectroDB Accounts entity
     */
    async createAccount(data: Partial<ExtendedAccount> & {id?: string}): Promise<ExtendedAccount> {
      logDebug('ElectroDB Adapter: createAccount', {data})

      const accountData = transformAccountFromAuth(data)
      const result = await Accounts.create(accountData).go()

      return transformAccountToAuth(result.data)
    },

    async getAccount(accountId: string): Promise<ExtendedAccount | null> {
      logDebug('ElectroDB Adapter: getAccount', {accountId})

      try {
        const result = await Accounts.get({accountId}).go()
        if (!result.data) {
          return null
        }

        return transformAccountToAuth(result.data)
      } catch (error) {
        logError('ElectroDB Adapter: getAccount failed', {accountId, error})
        return null
      }
    },

    async linkAccount(userId: string, accountId: string): Promise<void> {
      logDebug('ElectroDB Adapter: linkAccount', {userId, accountId})

      // ElectroDB entities already link via userId composite key
      // No additional operation needed - account is already linked via createAccount
    },

    /**
     * Verification Token Operations
     * Maps Better Auth verification token operations to ElectroDB VerificationTokens entity
     */
    async createVerificationToken(data: {identifier: string; token: string; expiresAt: Date}): Promise<void> {
      logDebug('ElectroDB Adapter: createVerificationToken', {data})

      await VerificationTokens.create({identifier: data.identifier, token: data.token, expiresAt: data.expiresAt.getTime()}).go()
    },

    async getVerificationToken(token: string): Promise<{identifier: string; token: string; expiresAt: Date} | null> {
      logDebug('ElectroDB Adapter: getVerificationToken', {token})

      try {
        const result = await VerificationTokens.get({token}).go()
        if (!result.data) {
          return null
        }

        return {identifier: result.data.identifier, token: result.data.token, expiresAt: new Date(result.data.expiresAt)}
      } catch (error) {
        logError('ElectroDB Adapter: getVerificationToken failed', {token, error})
        return null
      }
    },

    async deleteVerificationToken(token: string): Promise<void> {
      logDebug('ElectroDB Adapter: deleteVerificationToken', {token})

      await VerificationTokens.delete({token}).go()
    }
  }

  return adapter
}

/**
 * Exported transformer functions for testing
 * These allow integration tests to validate transformation logic against real DynamoDB
 */
export {
  transformAccountFromAuth,
  transformAccountToAuth,
  transformSessionFromAuth,
  transformSessionToAuth,
  transformSessionUpdateFromAuth,
  transformUserFromAuth,
  transformUserToAuth,
  transformUserUpdateFromAuth
}
