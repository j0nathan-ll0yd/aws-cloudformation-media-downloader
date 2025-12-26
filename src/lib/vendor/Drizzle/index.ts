/**
 * Drizzle ORM Vendor Wrapper
 *
 * This module encapsulates all Drizzle ORM functionality.
 * Domain code should import from this barrel file or specific submodules.
 *
 * Usage:
 * - Client: import {getDrizzleClient} from '#lib/vendor/Drizzle'
 * - Schema: import {users, files} from '#lib/vendor/Drizzle/schema'
 * - Types: import {eq, and} from '#lib/vendor/Drizzle/types'
 * - FK checks: import {assertUserExists} from '#lib/vendor/Drizzle/fk-enforcement'
 */

export { closeDrizzleClient, getDrizzleClient } from './client'
export type { PostgresJsDatabase } from './client'

export * from './schema'
export * from './types'
export * from './fk-enforcement'
