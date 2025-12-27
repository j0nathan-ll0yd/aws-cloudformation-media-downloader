/**
 * Users Entity - Core user account management.
 *
 * Manages user accounts with Sign In With Apple integration.
 * Identity providers are stored in a separate normalized table.
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Schema aligned with Better Auth official adapter expectations:
 * - Primary key: 'id' (UUID)
 * - Timestamps: Date objects (TIMESTAMP WITH TIME ZONE)
 *
 * Lifecycle:
 * 1. Created when user signs in with Apple for the first time (RegisterUser Lambda)
 * 2. Updated when tokens are refreshed or profile changes (LoginUser, RefreshToken)
 * 3. Deleted when user requests account deletion (UserDelete Lambda)
 *
 * Access Patterns:
 * - Primary: Get user by id
 * - byEmail: Look up user by email (login flow)
 * - byAppleDeviceId: Look up user by Apple device ID (token refresh)
 *
 * @see RegisterUser Lambda for account creation
 * @see LoginUser Lambda for authentication
 * @see UserDelete Lambda for cascade deletion
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

export const Users = {
  get(key: {id: string}): {go: () => Promise<{data: UserItem | null}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const userResult = await db.select().from(users).where(eq(users.id, key.id)).limit(1)

        if (userResult.length === 0) {
          return {data: null}
        }

        const idpResult = await db.select().from(identityProviders).where(eq(identityProviders.userId, key.id)).limit(1)

        const user = userResult[0]
        const idp = idpResult[0]

        return {
          data: {
            ...user,
            identityProviders: idp
              ? {
                userId: idp.providerUserId,
                email: idp.email,
                emailVerified: idp.emailVerified,
                isPrivateEmail: idp.isPrivateEmail,
                accessToken: idp.accessToken,
                refreshToken: idp.refreshToken,
                tokenType: idp.tokenType,
                expiresAt: idp.expiresAt
              }
              : undefined
          }
        }
      }
    }
  },

  create(input: CreateUserInput): {go: () => Promise<{data: UserItem}>} {
    return {
      go: async () => {
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

        return {data: {...user, identityProviders: idpData}}
      }
    }
  },

  update(key: {id: string}): {set: (data: UpdateUserInput) => {go: () => Promise<{data: UserItem}>}} {
    return {
      set: (data: UpdateUserInput) => ({
        go: async () => {
          const db = await getDrizzleClient()
          const [updated] = await db.update(users).set({...data, updatedAt: new Date()}).where(eq(users.id, key.id)).returning()

          const idpResult = await db.select().from(identityProviders).where(eq(identityProviders.userId, key.id)).limit(1)

          const idp = idpResult[0]

          return {
            data: {
              ...updated,
              identityProviders: idp
                ? {
                  userId: idp.providerUserId,
                  email: idp.email,
                  emailVerified: idp.emailVerified,
                  isPrivateEmail: idp.isPrivateEmail,
                  accessToken: idp.accessToken,
                  refreshToken: idp.refreshToken,
                  tokenType: idp.tokenType,
                  expiresAt: idp.expiresAt
                }
                : undefined
            }
          }
        }
      })
    }
  },

  delete(key: {id: string}): {go: () => Promise<Record<string, never>>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        await db.delete(identityProviders).where(eq(identityProviders.userId, key.id))
        await db.delete(users).where(eq(users.id, key.id))
        return {}
      }
    }
  },

  query: {
    byEmail(key: {email: string}): {go: () => Promise<{data: UserItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const userResult = await db.select().from(users).where(eq(users.email, key.email))

          const results: UserItem[] = []
          for (const user of userResult) {
            const idpResult = await db.select().from(identityProviders).where(eq(identityProviders.userId, user.id)).limit(1)

            const idp = idpResult[0]
            results.push({
              ...user,
              identityProviders: idp
                ? {
                  userId: idp.providerUserId,
                  email: idp.email,
                  emailVerified: idp.emailVerified,
                  isPrivateEmail: idp.isPrivateEmail,
                  accessToken: idp.accessToken,
                  refreshToken: idp.refreshToken,
                  tokenType: idp.tokenType,
                  expiresAt: idp.expiresAt
                }
                : undefined
            })
          }

          return {data: results}
        }
      }
    },

    byAppleDeviceId(key: {appleDeviceId: string}): {go: () => Promise<{data: UserItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const userResult = await db.select().from(users).where(eq(users.appleDeviceId, key.appleDeviceId))

          const results: UserItem[] = []
          for (const user of userResult) {
            const idpResult = await db.select().from(identityProviders).where(eq(identityProviders.userId, user.id)).limit(1)

            const idp = idpResult[0]
            results.push({
              ...user,
              identityProviders: idp
                ? {
                  userId: idp.providerUserId,
                  email: idp.email,
                  emailVerified: idp.emailVerified,
                  isPrivateEmail: idp.isPrivateEmail,
                  accessToken: idp.accessToken,
                  refreshToken: idp.refreshToken,
                  tokenType: idp.tokenType,
                  expiresAt: idp.expiresAt
                }
                : undefined
            })
          }

          return {data: results}
        }
      }
    }
  }
}
