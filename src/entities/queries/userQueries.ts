/**
 * User Queries - Drizzle ORM queries for user operations.
 *
 * All queries are instrumented with withQueryMetrics for CloudWatch metrics and X-Ray tracing.
 * OAuth account data is managed by Better Auth in the accounts table.
 *
 * @see src/lib/vendor/Drizzle/schema.ts for table definitions
 * @see src/lib/vendor/Drizzle/instrumentation.ts for query metrics
 */
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {withQueryMetrics} from '#lib/vendor/Drizzle/instrumentation'
import {users} from '#lib/vendor/Drizzle/schema'
import {eq} from '#lib/vendor/Drizzle/types'
import type {InferInsertModel, InferSelectModel} from '#lib/vendor/Drizzle/types'
import {userInsertSchema, userUpdateSchema} from '#lib/vendor/Drizzle/zodSchemas'

export type UserRow = InferSelectModel<typeof users>

export type UserItem = UserRow

export type CreateUserInput = Omit<InferInsertModel<typeof users>, 'id' | 'createdAt' | 'updatedAt'> & {id?: string}

export type UpdateUserInput = Partial<Omit<InferInsertModel<typeof users>, 'id' | 'createdAt'>>

/**
 * Gets a user by ID.
 * @param id - The user's UUID
 * @returns The user, or null if not found
 */
export async function getUser(id: string): Promise<UserItem | null> {
  return withQueryMetrics('Users.get', async () => {
    const db = await getDrizzleClient()
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
    return result[0] ?? null
  })
}

/**
 * Finds users by email.
 * @param email - The email address to search for
 * @returns Array of users matching the email
 */
export async function getUsersByEmail(email: string): Promise<UserItem[]> {
  return withQueryMetrics('Users.getByEmail', async () => {
    const db = await getDrizzleClient()
    return db.select().from(users).where(eq(users.email, email))
  })
}

/**
 * Creates a new user.
 * @param input - The user data
 * @returns The created user
 */
export async function createUser(input: CreateUserInput): Promise<UserItem> {
  return withQueryMetrics('Users.create', async () => {
    const validatedUser = userInsertSchema.parse(input)
    const db = await getDrizzleClient()
    const [user] = await db.insert(users).values({...validatedUser, updatedAt: new Date()}).returning()
    return user
  })
}

/**
 * Updates a user by ID.
 * @param id - The user's UUID
 * @param data - The fields to update
 * @returns The updated user
 */
export async function updateUser(id: string, data: UpdateUserInput): Promise<UserItem> {
  return withQueryMetrics('Users.update', async () => {
    const validatedData = userUpdateSchema.partial().parse(data)
    const db = await getDrizzleClient()
    const [updated] = await db.update(users).set({...validatedData, updatedAt: new Date()}).where(eq(users.id, id)).returning()
    return updated
  })
}

/**
 * Deletes a user by ID.
 * Note: Does NOT cascade - call deleteUserCascade for full cleanup.
 * @param id - The user's UUID
 */
export async function deleteUser(id: string): Promise<void> {
  return withQueryMetrics('Users.delete', async () => {
    const db = await getDrizzleClient()
    await db.delete(users).where(eq(users.id, id))
  })
}
