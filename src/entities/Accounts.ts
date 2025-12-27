/**
 * Accounts Entity - OAuth provider connections for Better Auth.
 *
 * Links users to OAuth identity providers (Sign In With Apple, Google, etc.).
 * One user can have multiple accounts (one per provider).
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Schema aligned with Better Auth official adapter expectations:
 * - Primary key: 'id' (UUID)
 * - Provider account ID: 'accountId' (Better Auth convention)
 * - Timestamps: Date objects (TIMESTAMP WITH TIME ZONE)
 *
 * Access Patterns:
 * - Primary: Get account by id
 * - byUser: Get all accounts for a user
 * - byProvider: Lookup by providerId + accountId
 *
 * @see LoginUser Lambda for account lookup
 * @see RegisterUser Lambda for account creation
 */
import {and, eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {accounts} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type AccountItem = InferSelectModel<typeof accounts>
export type CreateAccountInput = Omit<InferInsertModel<typeof accounts>, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  createdAt?: Date
  updatedAt?: Date
}
export type UpdateAccountInput = Partial<Omit<InferInsertModel<typeof accounts>, 'id' | 'createdAt'>>

export const Accounts = {
  get(key: {id: string}): {go: () => Promise<{data: AccountItem | null}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const result = await db.select().from(accounts).where(eq(accounts.id, key.id)).limit(1)
        return {data: result.length > 0 ? result[0] : null}
      }
    }
  },

  create(input: CreateAccountInput): {go: () => Promise<{data: AccountItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const now = new Date()
        const [account] = await db.insert(accounts).values({...input, createdAt: input.createdAt ?? now, updatedAt: input.updatedAt ?? now}).returning()

        return {data: account}
      }
    }
  },

  update(key: {id: string}): {set: (data: UpdateAccountInput) => {go: () => Promise<{data: AccountItem}>}} {
    return {
      set: (data: UpdateAccountInput) => ({
        go: async () => {
          const db = await getDrizzleClient()
          const now = new Date()
          const [updated] = await db.update(accounts).set({...data, updatedAt: now}).where(eq(accounts.id, key.id)).returning()

          return {data: updated}
        }
      })
    }
  },

  delete(key: {id: string}): {go: () => Promise<void>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        await db.delete(accounts).where(eq(accounts.id, key.id))
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

    byProvider(key: {providerId: string; accountId: string}): {go: () => Promise<{data: AccountItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(accounts).where(
            and(eq(accounts.providerId, key.providerId), eq(accounts.accountId, key.accountId))
          )
          return {data: result}
        }
      }
    }
  }
}
