/**
 * @fixture invalid
 * @rule drizzle-orm-encapsulation
 * @description Multiple direct drizzle-orm imports (forbidden)
 * @expectedViolations 2
 */
import {and, eq} from 'drizzle-orm'
import type {InferSelectModel} from 'drizzle-orm'
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {users} from '#lib/vendor/Drizzle/schema'

export async function handler() {
  const db = await getDrizzleClient()
  const result = await db.select().from(users).where(and(eq(users.id, '123'))).limit(1)
  return result.length > 0 ? result[0] : null
}
