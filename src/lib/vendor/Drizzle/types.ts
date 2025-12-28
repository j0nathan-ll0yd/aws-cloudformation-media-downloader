/**
 * Drizzle ORM Type Utilities
 *
 * Re-exports commonly used Drizzle types for use in entity definitions.
 * Domain code should import from this file, not directly from 'drizzle-orm'.
 *
 * @see {@link file://../../../../docs/wiki/Conventions/Vendor-Encapsulation-Policy.md | Vendor Encapsulation Policy} for usage examples
 */
import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'
import type {PgTable} from 'drizzle-orm/pg-core'

/** Infer the select (read) model type from a Drizzle table. Use this for return types and entity interfaces. */
export type SelectModel<T extends PgTable> = InferSelectModel<T>

/** Infer the insert (create) model type from a Drizzle table. Use this for create input types. */
export type InsertModel<T extends PgTable> = InferInsertModel<T>

/** Create a partial update type from a table, excluding the primary key. Use this for update input types. */
export type UpdateModel<T extends PgTable, K extends keyof InferInsertModel<T>> = Partial<Omit<InferInsertModel<T>, K>>

/**
 * Re-export core Drizzle types for advanced use cases.
 */
export type { InferInsertModel, InferSelectModel }

/**
 * Common Drizzle operators for queries.
 * Import these from drizzle-orm when needed in entity implementations.
 */
export { and, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql } from 'drizzle-orm'
