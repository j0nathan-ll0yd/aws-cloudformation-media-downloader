/**
 * Session Queries - Drizzle ORM queries for session operations.
 * All queries are instrumented with withQueryMetrics for CloudWatch metrics and X-Ray tracing.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/lib/vendor/Drizzle/instrumentation.ts for query metrics
 */
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {withQueryMetrics} from '#lib/vendor/Drizzle/instrumentation'
import {accounts, sessions, verification} from '#lib/vendor/Drizzle/schema'
import {eq, lt} from '#lib/vendor/Drizzle/types'
import type {InferInsertModel, InferSelectModel} from '#lib/vendor/Drizzle/types'
import {accountInsertSchema, sessionInsertSchema, sessionUpdateSchema, verificationInsertSchema} from '#lib/vendor/Drizzle/zodSchemas'
import {DatabaseOperation, DatabaseTable, RequiresTable} from '../decorators'

export type SessionRow = InferSelectModel<typeof sessions>
export type AccountRow = InferSelectModel<typeof accounts>
export type VerificationRow = InferSelectModel<typeof verification>

export type CreateSessionInput = Omit<InferInsertModel<typeof sessions>, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateSessionInput = Partial<Omit<InferInsertModel<typeof sessions>, 'id' | 'createdAt'>>

export type CreateAccountInput = Omit<InferInsertModel<typeof accounts>, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateAccountInput = Partial<Omit<InferInsertModel<typeof accounts>, 'id' | 'createdAt'>>

export type CreateVerificationInput = Omit<InferInsertModel<typeof verification>, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Session entity query operations with declarative permission metadata.
 * Each method declares the database permissions it requires via decorators.
 * Permissions are extracted at build time to generate Lambda database roles.
 */
class SessionQueries {
  // Session Operations

  /**
   * Gets a session by ID.
   * @param id - The session's unique identifier
   * @returns The session row or null if not found
   */
  @RequiresTable([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Select]}])
  static getSession(id: string): Promise<SessionRow | null> {
    return withQueryMetrics('Sessions.get', async () => {
      const db = await getDrizzleClient()
      const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
      return result.length > 0 ? result[0] : null
    })
  }

  /**
   * Gets a session by token.
   * @param token - The session token
   * @returns The session row or null if not found
   */
  @RequiresTable([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Select]}])
  static getSessionByToken(token: string): Promise<SessionRow | null> {
    return withQueryMetrics('Sessions.getByToken', async () => {
      const db = await getDrizzleClient()
      const result = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1)
      return result.length > 0 ? result[0] : null
    })
  }

  /**
   * Gets all sessions for a user.
   * @param userId - The user's unique identifier
   * @returns Array of session rows for the user
   */
  @RequiresTable([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Select]}])
  static getSessionsByUserId(userId: string): Promise<SessionRow[]> {
    return withQueryMetrics('Sessions.getByUserId', async () => {
      const db = await getDrizzleClient()
      return await db.select().from(sessions).where(eq(sessions.userId, userId))
    })
  }

  /**
   * Creates a new session.
   * @param input - The session data to create
   * @returns The created session row
   */
  @RequiresTable([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Insert]}])
  static createSession(input: CreateSessionInput): Promise<SessionRow> {
    return withQueryMetrics('Sessions.create', async () => {
      // Validate session input against schema
      const validatedInput = sessionInsertSchema.parse(input)
      const db = await getDrizzleClient()
      const [session] = await db.insert(sessions).values(validatedInput).returning()
      return session
    })
  }

  /**
   * Updates a session by ID.
   * @param id - The session's unique identifier
   * @param data - The fields to update
   * @returns The updated session row
   */
  @RequiresTable([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Update]}])
  static updateSession(id: string, data: UpdateSessionInput): Promise<SessionRow> {
    return withQueryMetrics('Sessions.update', async () => {
      // Validate partial update data against schema
      const validatedData = sessionUpdateSchema.partial().parse(data)
      const db = await getDrizzleClient()
      const [updated] = await db.update(sessions).set({...validatedData, updatedAt: new Date()}).where(eq(sessions.id, id)).returning()
      return updated
    })
  }

  /**
   * Deletes a session by ID.
   * @param id - The session's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Delete]}])
  static deleteSession(id: string): Promise<void> {
    return withQueryMetrics('Sessions.delete', async () => {
      const db = await getDrizzleClient()
      await db.delete(sessions).where(eq(sessions.id, id))
    })
  }

  /**
   * Deletes all sessions for a user.
   * @param userId - The user's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Delete]}])
  static deleteSessionsByUserId(userId: string): Promise<void> {
    return withQueryMetrics('Sessions.deleteByUserId', async () => {
      const db = await getDrizzleClient()
      await db.delete(sessions).where(eq(sessions.userId, userId))
    })
  }

  /**
   * Deletes expired sessions.
   */
  @RequiresTable([{table: DatabaseTable.Sessions, operations: [DatabaseOperation.Delete]}])
  static deleteExpiredSessions(): Promise<void> {
    return withQueryMetrics('Sessions.deleteExpired', async () => {
      const db = await getDrizzleClient()
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    })
  }

  // Account Operations

  /**
   * Gets an account by ID.
   * @param id - The account's unique identifier
   * @returns The account row or null if not found
   */
  @RequiresTable([{table: DatabaseTable.Accounts, operations: [DatabaseOperation.Select]}])
  static getAccount(id: string): Promise<AccountRow | null> {
    return withQueryMetrics('Accounts.get', async () => {
      const db = await getDrizzleClient()
      const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
      return result.length > 0 ? result[0] : null
    })
  }

  /**
   * Gets all accounts for a user.
   * @param userId - The user's unique identifier
   * @returns Array of account rows for the user
   */
  @RequiresTable([{table: DatabaseTable.Accounts, operations: [DatabaseOperation.Select]}])
  static getAccountsByUserId(userId: string): Promise<AccountRow[]> {
    return withQueryMetrics('Accounts.getByUserId', async () => {
      const db = await getDrizzleClient()
      return await db.select().from(accounts).where(eq(accounts.userId, userId))
    })
  }

  /**
   * Creates a new account.
   * @param input - The account data to create
   * @returns The created account row
   */
  @RequiresTable([{table: DatabaseTable.Accounts, operations: [DatabaseOperation.Insert]}])
  static createAccount(input: CreateAccountInput): Promise<AccountRow> {
    return withQueryMetrics('Accounts.create', async () => {
      // Validate account input against schema
      const validatedInput = accountInsertSchema.parse(input)
      const db = await getDrizzleClient()
      const [account] = await db.insert(accounts).values(validatedInput).returning()
      return account
    })
  }

  /**
   * Deletes an account by ID.
   * @param id - The account's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.Accounts, operations: [DatabaseOperation.Delete]}])
  static deleteAccount(id: string): Promise<void> {
    return withQueryMetrics('Accounts.delete', async () => {
      const db = await getDrizzleClient()
      await db.delete(accounts).where(eq(accounts.id, id))
    })
  }

  /**
   * Deletes all accounts for a user.
   * @param userId - The user's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.Accounts, operations: [DatabaseOperation.Delete]}])
  static deleteAccountsByUserId(userId: string): Promise<void> {
    return withQueryMetrics('Accounts.deleteByUserId', async () => {
      const db = await getDrizzleClient()
      await db.delete(accounts).where(eq(accounts.userId, userId))
    })
  }

  // Verification Operations

  /**
   * Gets a verification token by identifier.
   * @param identifier - The verification identifier
   * @returns The verification row or null if not found
   */
  @RequiresTable([{table: DatabaseTable.VerificationTokens, operations: [DatabaseOperation.Select]}])
  static getVerificationByIdentifier(identifier: string): Promise<VerificationRow | null> {
    return withQueryMetrics('Verifications.getByIdentifier', async () => {
      const db = await getDrizzleClient()
      const result = await db.select().from(verification).where(eq(verification.identifier, identifier)).limit(1)
      return result.length > 0 ? result[0] : null
    })
  }

  /**
   * Creates a new verification token.
   * @param input - The verification data to create
   * @returns The created verification row
   */
  @RequiresTable([{table: DatabaseTable.VerificationTokens, operations: [DatabaseOperation.Insert]}])
  static createVerification(input: CreateVerificationInput): Promise<VerificationRow> {
    return withQueryMetrics('Verifications.create', async () => {
      // Validate verification input against schema
      const validatedInput = verificationInsertSchema.parse(input)
      const db = await getDrizzleClient()
      const [token] = await db.insert(verification).values(validatedInput).returning()
      return token
    })
  }

  /**
   * Deletes a verification token by ID.
   * @param id - The verification token's unique identifier
   */
  @RequiresTable([{table: DatabaseTable.VerificationTokens, operations: [DatabaseOperation.Delete]}])
  static deleteVerification(id: string): Promise<void> {
    return withQueryMetrics('Verifications.delete', async () => {
      const db = await getDrizzleClient()
      await db.delete(verification).where(eq(verification.id, id))
    })
  }

  /**
   * Deletes expired verification tokens.
   */
  @RequiresTable([{table: DatabaseTable.VerificationTokens, operations: [DatabaseOperation.Delete]}])
  static deleteExpiredVerifications(): Promise<void> {
    return withQueryMetrics('Verifications.deleteExpired', async () => {
      const db = await getDrizzleClient()
      await db.delete(verification).where(lt(verification.expiresAt, new Date()))
    })
  }
}

// Re-export static methods as named exports for backwards compatibility
export const getSession = SessionQueries.getSession.bind(SessionQueries)
export const getSessionByToken = SessionQueries.getSessionByToken.bind(SessionQueries)
export const getSessionsByUserId = SessionQueries.getSessionsByUserId.bind(SessionQueries)
export const createSession = SessionQueries.createSession.bind(SessionQueries)
export const updateSession = SessionQueries.updateSession.bind(SessionQueries)
export const deleteSession = SessionQueries.deleteSession.bind(SessionQueries)
export const deleteSessionsByUserId = SessionQueries.deleteSessionsByUserId.bind(SessionQueries)
export const deleteExpiredSessions = SessionQueries.deleteExpiredSessions.bind(SessionQueries)
export const getAccount = SessionQueries.getAccount.bind(SessionQueries)
export const getAccountsByUserId = SessionQueries.getAccountsByUserId.bind(SessionQueries)
export const createAccount = SessionQueries.createAccount.bind(SessionQueries)
export const deleteAccount = SessionQueries.deleteAccount.bind(SessionQueries)
export const deleteAccountsByUserId = SessionQueries.deleteAccountsByUserId.bind(SessionQueries)
export const getVerificationByIdentifier = SessionQueries.getVerificationByIdentifier.bind(SessionQueries)
export const createVerification = SessionQueries.createVerification.bind(SessionQueries)
export const deleteVerification = SessionQueries.deleteVerification.bind(SessionQueries)
export const deleteExpiredVerifications = SessionQueries.deleteExpiredVerifications.bind(SessionQueries)

// Export class for extraction script access
export { SessionQueries }
