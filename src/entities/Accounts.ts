/**
 * Accounts Entity - OAuth provider connections for Better Auth.
 *
 * Links users to OAuth identity providers (Sign In With Apple, Google, etc.).
 * One user can have multiple accounts (one per provider).
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Access Patterns:
 * - Primary: Get account by accountId
 * - byUser: Get all accounts for a user
 * - byProvider: Lookup by providerId + providerAccountId
 *
 * @see LoginUser Lambda for account lookup
 * @see RegisterUser Lambda for account creation
 */
import {and, eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {accounts} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type AccountItem = InferSelectModel<typeof accounts>
export type CreateAccountInput = Omit<InferInsertModel<typeof accounts>, 'accountId' | 'createdAt' | 'updatedAt'> & {
  accountId?: string
  createdAt?: number
  updatedAt?: number
}
export type UpdateAccountInput = Partial<Omit<InferInsertModel<typeof accounts>, 'accountId' | 'createdAt'>>

export const Accounts = {
  get(key: {accountId: string}): {go: () => Promise<{data: AccountItem | null}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const result = await db.select().from(accounts).where(eq(accounts.accountId, key.accountId)).limit(1)

        return {data: result.length > 0 ? result[0] : null}
      }
    }
  },

  create(input: CreateAccountInput): {go: () => Promise<{data: AccountItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const now = Math.floor(Date.now() / 1000)
        const [account] = await db.insert(accounts).values({...input, createdAt: input.createdAt ?? now, updatedAt: input.updatedAt ?? now}).returning()

        return {data: account}
      }
    }
  },

  update(key: {accountId: string}): {set: (data: UpdateAccountInput) => {go: () => Promise<{data: AccountItem}>}} {
    return {
      set: (data: UpdateAccountInput) => ({
        go: async () => {
          const db = await getDrizzleClient()
          const now = Math.floor(Date.now() / 1000)
          const [updated] = await db.update(accounts).set({...data, updatedAt: now}).where(eq(accounts.accountId, key.accountId)).returning()

          return {data: updated}
        }
      })
    }
  },

  delete(key: {accountId: string}): {go: () => Promise<void>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        await db.delete(accounts).where(eq(accounts.accountId, key.accountId))
      }
    }
  },

  query: {
    byUser(key: {userId: string}): {go: () => Promise<{data: AccountItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(accounts).where(eq(accounts.userId, key.userId))
          return {data: result}
        }
      }
    },

    byProvider(key: {providerId: string; providerAccountId: string}): {go: () => Promise<{data: AccountItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(accounts).where(
            and(eq(accounts.providerId, key.providerId), eq(accounts.providerAccountId, key.providerAccountId))
          )

          return {data: result}
        }
      }
    }
  }
}
