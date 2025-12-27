/**
 * VerificationTokens Entity - Better Auth verification tokens.
 *
 * Stores email verification and password reset tokens.
 * Expired tokens cleaned up by CleanupExpiredRecords Lambda.
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Schema aligned with Better Auth official adapter expectations:
 * - Primary key: 'id' (UUID)
 * - Token field: 'value' (Better Auth convention)
 * - Timestamps: Date objects (TIMESTAMP WITH TIME ZONE)
 *
 * Note: TTL is no longer handled by DynamoDB. Expired tokens are cleaned up
 * by the CleanupExpiredRecords scheduled Lambda.
 *
 * Access Patterns:
 * - Primary: Get token by id
 * - byValue: Get token by value (token validation)
 * - byIdentifier: Lookup tokens by email/identifier
 */
import {eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {verification} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type VerificationTokenItem = InferSelectModel<typeof verification>
export type CreateVerificationTokenInput = Omit<InferInsertModel<typeof verification>, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  createdAt?: Date
  updatedAt?: Date
}

export const VerificationTokens = {
  get(key: {id: string}): {go: () => Promise<{data: VerificationTokenItem | null}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const result = await db.select().from(verification).where(eq(verification.id, key.id)).limit(1)
        return {data: result.length > 0 ? result[0] : null}
      }
    }
  },

  create(input: CreateVerificationTokenInput): {go: () => Promise<{data: VerificationTokenItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const now = new Date()
        const [token] = await db.insert(verification).values({...input, createdAt: input.createdAt ?? now, updatedAt: input.updatedAt ?? now}).returning()

        return {data: token}
      }
    }
  },

  update(key: {id: string}): {set: (data: Partial<CreateVerificationTokenInput>) => {go: () => Promise<{data: VerificationTokenItem}>}} {
    return {
      set: (data: Partial<CreateVerificationTokenInput>) => ({
        go: async () => {
          const db = await getDrizzleClient()
          const now = new Date()
          const [updated] = await db.update(verification).set({...data, updatedAt: now}).where(eq(verification.id, key.id)).returning()

          return {data: updated}
        }
      })
    }
  },

  delete(key: {id: string}): {go: () => Promise<void>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        await db.delete(verification).where(eq(verification.id, key.id))
      }
    }
  },

  query: {
    byValue(key: {value: string}): {go: () => Promise<{data: VerificationTokenItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(verification).where(eq(verification.value, key.value))
          return {data: result}
        }
      }
    },

    byIdentifier(key: {identifier: string}): {go: () => Promise<{data: VerificationTokenItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(verification).where(eq(verification.identifier, key.identifier))
          return {data: result}
        }
      }
    }
  }
}
