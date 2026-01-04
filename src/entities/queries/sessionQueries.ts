/**
 * Session Queries - Native Drizzle ORM queries for session operations.
 *
 * Replaces the ElectroDB-style Sessions entity wrapper with direct Drizzle queries.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/entities/Sessions.ts for legacy ElectroDB wrapper (to be deprecated)
 */
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {accounts, sessions, verification} from '#lib/vendor/Drizzle/schema'
import {eq, lt} from '#lib/vendor/Drizzle/types'
import type {InferInsertModel, InferSelectModel} from '#lib/vendor/Drizzle/types'
import {accountInsertSchema, sessionInsertSchema, sessionUpdateSchema, verificationInsertSchema} from '#lib/vendor/Drizzle/zodSchemas'

export type SessionRow = InferSelectModel<typeof sessions>
export type AccountRow = InferSelectModel<typeof accounts>
export type VerificationRow = InferSelectModel<typeof verification>

export type CreateSessionInput = Omit<InferInsertModel<typeof sessions>, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateSessionInput = Partial<Omit<InferInsertModel<typeof sessions>, 'id' | 'createdAt'>>

export type CreateAccountInput = Omit<InferInsertModel<typeof accounts>, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateAccountInput = Partial<Omit<InferInsertModel<typeof accounts>, 'id' | 'createdAt'>>

export type CreateVerificationInput = Omit<InferInsertModel<typeof verification>, 'id' | 'createdAt' | 'updatedAt'>

// Session Operations

/**
 * Gets a session by ID.
 * @param id - The session's unique identifier
 * @returns The session row or null if not found
 */
export async function getSession(id: string): Promise<SessionRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
  return result.length > 0 ? result[0] : null
}

/**
 * Gets a session by token.
 * @param token - The session token
 * @returns The session row or null if not found
 */
export async function getSessionByToken(token: string): Promise<SessionRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1)
  return result.length > 0 ? result[0] : null
}

/**
 * Gets all sessions for a user.
 * @param userId - The user's unique identifier
 * @returns Array of session rows for the user
 */
export async function getSessionsByUserId(userId: string): Promise<SessionRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(sessions).where(eq(sessions.userId, userId))
}

/**
 * Creates a new session.
 * @param input - The session data to create
 * @returns The created session row
 */
export async function createSession(input: CreateSessionInput): Promise<SessionRow> {
  // Validate session input against schema
  const validatedInput = sessionInsertSchema.parse(input)
  const db = await getDrizzleClient()
  const [session] = await db.insert(sessions).values(validatedInput).returning()
  return session
}

/**
 * Updates a session by ID.
 * @param id - The session's unique identifier
 * @param data - The fields to update
 * @returns The updated session row
 */
export async function updateSession(id: string, data: UpdateSessionInput): Promise<SessionRow> {
  // Validate partial update data against schema
  const validatedData = sessionUpdateSchema.partial().parse(data)
  const db = await getDrizzleClient()
  const [updated] = await db.update(sessions).set({...validatedData, updatedAt: new Date()}).where(eq(sessions.id, id)).returning()
  return updated
}

/**
 * Deletes a session by ID.
 * @param id - The session's unique identifier
 */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(sessions).where(eq(sessions.id, id))
}

/**
 * Deletes all sessions for a user.
 * @param userId - The user's unique identifier
 */
export async function deleteSessionsByUserId(userId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

/**
 * Deletes expired sessions.
 */
export async function deleteExpiredSessions(): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}

// Account Operations

/**
 * Gets an account by ID.
 * @param id - The account's unique identifier
 * @returns The account row or null if not found
 */
export async function getAccount(id: string): Promise<AccountRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  return result.length > 0 ? result[0] : null
}

/**
 * Gets all accounts for a user.
 * @param userId - The user's unique identifier
 * @returns Array of account rows for the user
 */
export async function getAccountsByUserId(userId: string): Promise<AccountRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(accounts).where(eq(accounts.userId, userId))
}

/**
 * Creates a new account.
 * @param input - The account data to create
 * @returns The created account row
 */
export async function createAccount(input: CreateAccountInput): Promise<AccountRow> {
  // Validate account input against schema
  const validatedInput = accountInsertSchema.parse(input)
  const db = await getDrizzleClient()
  const [account] = await db.insert(accounts).values(validatedInput).returning()
  return account
}

/**
 * Deletes an account by ID.
 * @param id - The account's unique identifier
 */
export async function deleteAccount(id: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(accounts).where(eq(accounts.id, id))
}

/**
 * Deletes all accounts for a user.
 * @param userId - The user's unique identifier
 */
export async function deleteAccountsByUserId(userId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(accounts).where(eq(accounts.userId, userId))
}

// Verification Operations

/**
 * Gets a verification token by identifier.
 * @param identifier - The verification identifier
 * @returns The verification row or null if not found
 */
export async function getVerificationByIdentifier(identifier: string): Promise<VerificationRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(verification).where(eq(verification.identifier, identifier)).limit(1)
  return result.length > 0 ? result[0] : null
}

/**
 * Creates a new verification token.
 * @param input - The verification data to create
 * @returns The created verification row
 */
export async function createVerification(input: CreateVerificationInput): Promise<VerificationRow> {
  // Validate verification input against schema
  const validatedInput = verificationInsertSchema.parse(input)
  const db = await getDrizzleClient()
  const [token] = await db.insert(verification).values(validatedInput).returning()
  return token
}

/**
 * Deletes a verification token by ID.
 * @param id - The verification token's unique identifier
 */
export async function deleteVerification(id: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(verification).where(eq(verification.id, id))
}

/**
 * Deletes expired verification tokens.
 */
export async function deleteExpiredVerifications(): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(verification).where(lt(verification.expiresAt, new Date()))
}
