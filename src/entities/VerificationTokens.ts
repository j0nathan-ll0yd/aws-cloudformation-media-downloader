/**
 * VerificationTokens Entity - Better Auth verification tokens.
 *
 * Stores email verification and password reset tokens.
 * Expired tokens cleaned up by CleanupExpiredRecords Lambda.
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Note: TTL is no longer handled by DynamoDB. Expired tokens are cleaned up
 * by the CleanupExpiredRecords scheduled Lambda.
 *
 * Access Patterns:
 * - Primary: Get token by token value
 * - byIdentifier: Lookup tokens by email/identifier
 */
import {eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {verificationTokens} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type VerificationTokenItem = InferSelectModel<typeof verificationTokens>
export type CreateVerificationTokenInput = Omit<InferInsertModel<typeof verificationTokens>, 'createdAt'> & {createdAt?: number}

export const VerificationTokens = {
  get(key: {token: string}): {go: () => Promise<{data: VerificationTokenItem | null}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const result = await db.select().from(verificationTokens).where(eq(verificationTokens.token, key.token)).limit(1)

        return {data: result.length > 0 ? result[0] : null}
      }
    }
  },

  create(input: CreateVerificationTokenInput): {go: () => Promise<{data: VerificationTokenItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const now = Math.floor(Date.now() / 1000)
        const [token] = await db.insert(verificationTokens).values({...input, createdAt: input.createdAt ?? now}).returning()

        return {data: token}
      }
    }
  },

  update(key: {token: string}): {set: (data: Partial<CreateVerificationTokenInput>) => {go: () => Promise<{data: VerificationTokenItem}>}} {
    return {
      set: (data: Partial<CreateVerificationTokenInput>) => ({
        go: async () => {
          const db = await getDrizzleClient()
          const [updated] = await db.update(verificationTokens).set(data).where(eq(verificationTokens.token, key.token)).returning()

          return {data: updated}
        }
      })
    }
  },

  delete(key: {token: string}): {go: () => Promise<void>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        await db.delete(verificationTokens).where(eq(verificationTokens.token, key.token))
      }
    }
  },

  query: {
    byIdentifier(key: {identifier: string}): {go: () => Promise<{data: VerificationTokenItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(verificationTokens).where(eq(verificationTokens.identifier, key.identifier))

          return {data: result}
        }
      }
    }
  }
}
