/**
 * Sessions Entity - Better Auth user session management.
 *
 * Stores authentication sessions with automatic expiration.
 * Expired sessions cleaned up by CleanupExpiredRecords Lambda.
 *
 * This entity provides an ElectroDB-compatible interface over Drizzle ORM
 * to minimize changes to Lambda handlers during the migration.
 *
 * Schema aligned with Better Auth official adapter expectations:
 * - Primary key: 'id' (UUID)
 * - Timestamps: Date objects (TIMESTAMP WITH TIME ZONE)
 *
 * Access Patterns:
 * - Primary: Get session by id
 * - byUser: Get all sessions for a user (logout-all, session list)
 * - byToken: Validate session token (request authentication)
 *
 * @see LoginUser Lambda for session creation
 * @see ApiGatewayAuthorizer for session validation
 * @see RefreshToken Lambda for session refresh
 */
import {eq} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {sessions} from '#lib/vendor/Drizzle/schema'
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'

export type SessionItem = InferSelectModel<typeof sessions>
export type CreateSessionInput = Omit<InferInsertModel<typeof sessions>, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  createdAt?: Date
  updatedAt?: Date
}
export type UpdateSessionInput = Partial<Omit<InferInsertModel<typeof sessions>, 'id' | 'createdAt'>>

export const Sessions = {
  get(key: {id: string}): {go: () => Promise<{data: SessionItem | null}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const result = await db.select().from(sessions).where(eq(sessions.id, key.id)).limit(1)
        return {data: result.length > 0 ? result[0] : null}
      }
    }
  },

  create(input: CreateSessionInput): {go: () => Promise<{data: SessionItem}>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        const now = new Date()
        const [session] = await db.insert(sessions).values({...input, createdAt: input.createdAt ?? now, updatedAt: input.updatedAt ?? now}).returning()

        return {data: session}
      }
    }
  },

  update(key: {id: string}): {set: (data: UpdateSessionInput) => {go: () => Promise<{data: SessionItem}>}} {
    return {
      set: (data: UpdateSessionInput) => ({
        go: async () => {
          const db = await getDrizzleClient()
          const now = new Date()
          const [updated] = await db.update(sessions).set({...data, updatedAt: now}).where(eq(sessions.id, key.id)).returning()

          return {data: updated}
        }
      })
    }
  },

  delete(key: {id: string}): {go: () => Promise<void>} {
    return {
      go: async () => {
        const db = await getDrizzleClient()
        await db.delete(sessions).where(eq(sessions.id, key.id))
      }
    }
  },

  query: {
    byUser(key: {userId: string}): {go: () => Promise<{data: SessionItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(sessions).where(eq(sessions.userId, key.userId))
          return {data: result}
        }
      }
    },

    byToken(key: {token: string}): {go: () => Promise<{data: SessionItem[]}>} {
      return {
        go: async () => {
          const db = await getDrizzleClient()
          const result = await db.select().from(sessions).where(eq(sessions.token, key.token))
          return {data: result}
        }
      }
    }
  }
}
