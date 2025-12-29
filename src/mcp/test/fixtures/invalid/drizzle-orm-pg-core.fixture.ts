/**
 * @fixture invalid
 * @rule drizzle-orm-encapsulation
 * @description Direct drizzle-orm/pg-core import (forbidden)
 * @expectedViolations 1
 */
import {pgTable, text, timestamp} from 'drizzle-orm/pg-core'

export const customTable = pgTable('custom_table', {id: text('id').primaryKey(), createdAt: timestamp('created_at').defaultNow()})
