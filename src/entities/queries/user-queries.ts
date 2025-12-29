/**
 * User Queries - Native Drizzle ORM queries for user operations.
 *
 * Replaces the ElectroDB-style Users entity wrapper with direct Drizzle queries.
 * Uses LEFT JOINs to fetch identity providers efficiently (no N+1 queries).
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/entities/Users.ts for legacy ElectroDB wrapper (to be deprecated)
 */
import {eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {identityProviders, users} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type UserRow = InferSelectModel<typeof users>
export type IdentityProviderRow = InferSelectModel<typeof identityProviders>

export interface IdentityProviderData {
  userId: string
  email: string
  emailVerified: boolean
  isPrivateEmail: boolean
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresAt: number
}

export type UserItem = UserRow & {identityProviders?: IdentityProviderData}

export type CreateUserInput = Omit<InferInsertModel<typeof users>, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  identityProviders?: IdentityProviderData
}

export type UpdateUserInput = Partial<Omit<InferInsertModel<typeof users>, 'id' | 'createdAt'>>

// Transform identity provider row to IdentityProviderData format
function transformIdp(idp: IdentityProviderRow | null): IdentityProviderData | undefined {
  if (!idp) {
    return undefined
  }
  return {
    userId: idp.providerUserId,
    email: idp.email,
    emailVerified: idp.emailVerified,
    isPrivateEmail: idp.isPrivateEmail,
    accessToken: idp.accessToken,
    refreshToken: idp.refreshToken,
    tokenType: idp.tokenType,
    expiresAt: idp.expiresAt
  }
}

// Get a user by ID with their identity provider (single JOIN query)
export async function getUser(id: string): Promise<UserItem | null> {
  const db = await getDrizzleClient()

  const result = await db.select({user: users, idp: identityProviders}).from(users).leftJoin(identityProviders, eq(users.id, identityProviders.userId))
    .where(eq(users.id, id)).limit(1)

  if (result.length === 0) {
    return null
  }

  const {user, idp} = result[0]
  return {...user, identityProviders: transformIdp(idp)}
}

// Find users by email with identity providers (single JOIN query)
export async function getUsersByEmail(email: string): Promise<UserItem[]> {
  const db = await getDrizzleClient()
  const results = await db.select({user: users, idp: identityProviders}).from(users).leftJoin(identityProviders, eq(users.id, identityProviders.userId))
    .where(eq(users.email, email))
  return results.map(({user, idp}) => ({...user, identityProviders: transformIdp(idp)}))
}

// Find users by Apple device ID with identity providers (single JOIN query)
export async function getUsersByAppleDeviceId(appleDeviceId: string): Promise<UserItem[]> {
  const db = await getDrizzleClient()
  const results = await db.select({user: users, idp: identityProviders}).from(users).leftJoin(identityProviders, eq(users.id, identityProviders.userId))
    .where(eq(users.appleDeviceId, appleDeviceId))
  return results.map(({user, idp}) => ({...user, identityProviders: transformIdp(idp)}))
}

// Create a new user with optional identity provider
export async function createUser(input: CreateUserInput): Promise<UserItem> {
  const db = await getDrizzleClient()
  const {identityProviders: idpData, ...userData} = input

  const [user] = await db.insert(users).values({...userData, updatedAt: new Date()}).returning()

  if (idpData) {
    await db.insert(identityProviders).values({
      userId: user.id,
      providerUserId: idpData.userId,
      email: idpData.email,
      emailVerified: idpData.emailVerified,
      isPrivateEmail: idpData.isPrivateEmail,
      accessToken: idpData.accessToken,
      refreshToken: idpData.refreshToken,
      tokenType: idpData.tokenType,
      expiresAt: idpData.expiresAt
    })
  }

  return {...user, identityProviders: idpData}
}

// Update a user by ID
export async function updateUser(id: string, data: UpdateUserInput): Promise<UserItem> {
  const db = await getDrizzleClient()
  const [updated] = await db.update(users).set({...data, updatedAt: new Date()}).where(eq(users.id, id)).returning()

  // Fetch identity provider with separate query (only 1 user, not N+1)
  const idpResult = await db.select().from(identityProviders).where(eq(identityProviders.userId, id)).limit(1)

  return {...updated, identityProviders: transformIdp(idpResult[0] ?? null)}
}

// Delete a user by ID (does NOT cascade - call deleteUserCascade for full cleanup)
export async function deleteUser(id: string): Promise<void> {
  const db = await getDrizzleClient()
  await db.delete(identityProviders).where(eq(identityProviders.userId, id))
  await db.delete(users).where(eq(users.id, id))
}
