/**
 * @fixture valid
 * @rule drizzle-orm-encapsulation
 * @description Using Drizzle vendor wrappers (allowed)
 * @expectedViolations 0
 */
import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {users} from '#lib/vendor/Drizzle/schema'
import {and, eq} from '#lib/vendor/Drizzle/types'
import type {InferSelectModel} from '#lib/vendor/Drizzle/types'

type User = InferSelectModel<typeof users>

export async function handler(): Promise<User | null> {
  const db = await getDrizzleClient()
  const result = await db.select().from(users).where(and(eq(users.id, '123'))).limit(1)
  return result.length > 0 ? result[0] : null
}
