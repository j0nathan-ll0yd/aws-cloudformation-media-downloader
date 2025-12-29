/**
 * Session Queries - Native Drizzle ORM queries for session operations.
 *
 * Replaces the ElectroDB-style Sessions entity wrapper with direct Drizzle queries.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/entities/Sessions.ts for legacy ElectroDB wrapper (to be deprecated)
 */
import {eq, lt} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {accounts, sessions, verification} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type SessionRow = InferSelectModel<typeof sessions>
export type AccountRow = InferSelectModel<typeof accounts>
export type VerificationRow = InferSelectModel<typeof verification>

export type CreateSessionInput = Omit<InferInsertModel<typeof sessions>, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateSessionInput = Partial<Omit<InferInsertModel<typeof sessions>, 'id' | 'createdAt'>>

export type CreateAccountInput = Omit<InferInsertModel<typeof accounts>, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateAccountInput = Partial<Omit<InferInsertModel<typeof accounts>, 'id' | 'createdAt'>>

export type CreateVerificationInput = Omit<InferInsertModel<typeof verification>, 'id' | 'createdAt' | 'updatedAt'>

// Session Operations

// Get a session by ID
export async function getSession(id: string): Promise<SessionRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
  return result.length > 0 ? result[0] : null
}

// Get a session by token
export async function getSessionByToken(token: string): Promise<SessionRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1)
  return result.length > 0 ? result[0] : null
}

// Get all sessions for a user
export async function getSessionsByUserId(userId: string): Promise<SessionRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(sessions).where(eq(sessions.userId, userId))
}

// Create a new session
export async function createSession(input: CreateSessionInput): Promise<SessionRow> {
  const db = await getDrizzleClient()
  const [session] = await db.insert(sessions).values(input).returning()
  return session
}

// Update a session by ID
export async function updateSession(id: string, data: UpdateSessionInput): Promise<SessionRow> {
  const db = await getDrizzleClient()
  const [updated] = await db.update(sessions).set({...data, updatedAt: new Date()}).where(eq(sessions.id, id)).returning()
  return updated
}

// Delete a session by ID
export async function deleteSession(id: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(sessions).where(eq(sessions.id, id))
}

// Delete all sessions for a user
export async function deleteSessionsByUserId(userId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

// Delete expired sessions
export async function deleteExpiredSessions(): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}

// Account Operations

// Get an account by ID
export async function getAccount(id: string): Promise<AccountRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1)
  return result.length > 0 ? result[0] : null
}

// Get all accounts for a user
export async function getAccountsByUserId(userId: string): Promise<AccountRow[]> {
  const db = await getDrizzleClient()
  return await db.select().from(accounts).where(eq(accounts.userId, userId))
}

// Create a new account
export async function createAccount(input: CreateAccountInput): Promise<AccountRow> {
  const db = await getDrizzleClient()
  const [account] = await db.insert(accounts).values(input).returning()
  return account
}

// Delete an account by ID
export async function deleteAccount(id: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(accounts).where(eq(accounts.id, id))
}

// Delete all accounts for a user
export async function deleteAccountsByUserId(userId: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(accounts).where(eq(accounts.userId, userId))
}

// Verification Operations

// Get a verification token by identifier
export async function getVerificationByIdentifier(identifier: string): Promise<VerificationRow | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(verification).where(eq(verification.identifier, identifier)).limit(1)
  return result.length > 0 ? result[0] : null
}

// Create a new verification token
export async function createVerification(input: CreateVerificationInput): Promise<VerificationRow> {
  const db = await getDrizzleClient()
  const [token] = await db.insert(verification).values(input).returning()
  return token
}

// Delete a verification token by ID
export async function deleteVerification(id: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(verification).where(eq(verification.id, id))
}

// Delete expired verification tokens
export async function deleteExpiredVerifications(): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(verification).where(lt(verification.expiresAt, new Date()))
}
