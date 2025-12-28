/**
 * Drizzle ORM Vendor Wrapper
 *
 * This module encapsulates all Drizzle ORM functionality.
 * Domain code should import from this barrel file or specific submodules.
 *
 * @see {@link file://../../../docs/wiki/Conventions/Vendor-Encapsulation-Policy.md | Vendor Encapsulation Policy} for usage examples
 */

export { closeDrizzleClient, getDrizzleClient } from './client'
export type { PostgresJsDatabase } from './client'

export * from './schema'
export * from './types'
export * from './fk-enforcement'
