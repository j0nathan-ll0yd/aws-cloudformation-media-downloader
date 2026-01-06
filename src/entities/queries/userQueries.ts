/**
 * User Queries - Drizzle ORM queries for user operations.
 *
 * Uses LEFT JOINs to fetch identity providers efficiently (no N+1 queries).
 * All queries are instrumented with withQueryMetrics for CloudWatch metrics and X-Ray tracing.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/lib/vendor/Drizzle/instrumentation.ts for query metrics
 */
import {getDrizzleClient, withTransaction} from '#lib/vendor/Drizzle/client'
import {withQueryMetrics} from '#lib/vendor/Drizzle/instrumentation'
import {identityProviders, users} from '#lib/vendor/Drizzle/schema'
import {eq} from '#lib/vendor/Drizzle/types'
import type {InferInsertModel, InferSelectModel} from '#lib/vendor/Drizzle/types'
import {userInsertSchema, userUpdateSchema} from '#lib/vendor/Drizzle/zodSchemas'

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

/**
 * Transforms an identity provider row to the IdentityProviderData format.
 * @param idp - The identity provider row from the database
 * @returns The transformed identity provider data or undefined if null
 */
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

/**
 * Gets a user by ID with their identity provider (single JOIN query).
 * @param id - The user's UUID
 * @returns The user with identity provider data, or null if not found
 */
export async function getUser(id: string): Promise<UserItem | null> {
  return withQueryMetrics('Users.get', async () => {
    const db = await getDrizzleClient()

    const result = await db.select({user: users, idp: identityProviders}).from(users).leftJoin(identityProviders, eq(users.id, identityProviders.userId))
      .where(eq(users.id, id)).limit(1)

    if (result.length === 0) {
      return null
    }

    const {user, idp} = result[0]
    return {...user, identityProviders: transformIdp(idp)}
  })
}

/**
 * Finds users by email with identity providers (single JOIN query).
 * @param email - The email address to search for
 * @returns Array of users matching the email with their identity providers
 */
export async function getUsersByEmail(email: string): Promise<UserItem[]> {
  return withQueryMetrics('Users.getByEmail', async () => {
    const db = await getDrizzleClient()
    const results = await db.select({user: users, idp: identityProviders}).from(users).leftJoin(identityProviders, eq(users.id, identityProviders.userId))
      .where(eq(users.email, email))
    return results.map(({user, idp}) => ({...user, identityProviders: transformIdp(idp)}))
  })
}

/**
 * Creates a new user with optional identity provider.
 * Uses a transaction to ensure atomicity - if identity provider insert fails,
 * the user insert is rolled back.
 * @param input - The user data including optional identity provider
 * @returns The created user with identity provider data
 */
export async function createUser(input: CreateUserInput): Promise<UserItem> {
  return withQueryMetrics('Users.create', async () => {
    // Validate user input against schema
    const validatedUser = userInsertSchema.parse(input)
    const {identityProviders: idpData, ...userData} = {...validatedUser, identityProviders: input.identityProviders}
    return await withTransaction(async (tx) => {
      const [user] = await tx.insert(users).values({...userData, updatedAt: new Date()}).returning()
      if (idpData) {
        await tx.insert(identityProviders).values({
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
    })
  })
}

/**
 * Updates a user by ID.
 * @param id - The user's UUID
 * @param data - The fields to update
 * @returns The updated user with identity provider data
 */
export async function updateUser(id: string, data: UpdateUserInput): Promise<UserItem> {
  return withQueryMetrics('Users.update', async () => {
    // Validate partial update data against schema
    const validatedData = userUpdateSchema.partial().parse(data)
    const db = await getDrizzleClient()
    const [updated] = await db.update(users).set({...validatedData, updatedAt: new Date()}).where(eq(users.id, id)).returning()

    // Fetch identity provider with separate query (only 1 user, not N+1)
    const idpResult = await db.select().from(identityProviders).where(eq(identityProviders.userId, id)).limit(1)

    return {...updated, identityProviders: transformIdp(idpResult[0] ?? null)}
  })
}

/**
 * Deletes a user by ID.
 * Uses a transaction to ensure atomicity - identity provider and user are
 * deleted together or not at all.
 * Note: Does NOT cascade - call deleteUserCascade for full cleanup.
 * @param id - The user's UUID
 */
export async function deleteUser(id: string): Promise<void> {
  return withQueryMetrics('Users.delete', async () => {
    await withTransaction(async (tx) => {
      await tx.delete(identityProviders).where(eq(identityProviders.userId, id))
      await tx.delete(users).where(eq(users.id, id))
    })
  })
}
