/**
 * Unit tests for migrations-safety rule
 * CRITICAL: Schema changes must only occur in migrations, not in application code
 *
 * This enforces "Migrations as Single Source of Truth" - a zero-tolerance convention
 * per project standards. Schema definitions belong in src/lib/vendor/Drizzle/schema.ts
 * and DDL statements belong in migrations/*.sql files only.
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let migrationsSafetyRule: typeof import('./migrations-safety').migrationsSafetyRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./migrations-safety')
  migrationsSafetyRule = module.migrationsSafetyRule
})

describe('migrations-safety rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(migrationsSafetyRule.name).toBe('migrations-safety')
    })

    test('should have CRITICAL severity', () => {
      expect(migrationsSafetyRule.severity).toBe('CRITICAL')
    })

    test('should apply to TypeScript source files', () => {
      expect(migrationsSafetyRule.appliesTo).toContain('src/**/*.ts')
    })

    test('should exclude test files', () => {
      expect(migrationsSafetyRule.excludes).toContain('src/**/*.test.ts')
      expect(migrationsSafetyRule.excludes).toContain('test/**/*.ts')
    })

    test('should exclude schema.ts', () => {
      expect(migrationsSafetyRule.excludes).toContain('src/lib/vendor/Drizzle/schema.ts')
    })
  })

  describe('allows schema.ts table definitions', () => {
    test('should allow pgTable() in schema.ts', () => {
      const sourceFile = project.createSourceFile('test-schema-pgtable.ts', `import {pgTable, text, uuid} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull()
})`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lib/vendor/Drizzle/schema.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow drizzle-orm/pg-core imports in schema.ts', () => {
      const sourceFile = project.createSourceFile('test-schema-imports.ts', `import {pgTable, text, uuid, timestamp} from 'drizzle-orm/pg-core'`, {
        overwrite: true
      })

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lib/vendor/Drizzle/schema.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('allows migration runner Lambda', () => {
    test('should allow DDL execution in MigrateDSQL Lambda', () => {
      const sourceFile = project.createSourceFile('test-migrate-lambda.ts', `import {sql} from 'drizzle-orm'

const migration = sql.raw('CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY)')
await db.execute(migration)`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/MigrateDSQL/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow ALTER TABLE in migration runner', () => {
      const sourceFile = project.createSourceFile('test-migrate-alter.ts', `const alterSql = sql.raw('ALTER TABLE users ADD COLUMN name text')`, {
        overwrite: true
      })

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/MigrateDSQL/src/migrate.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('detects pgTable imports outside schema.ts', () => {
    test('should detect pgTable import in Lambda handler', () => {
      const sourceFile = project.createSourceFile('test-lambda-pgtable-import.ts', `import {pgTable, text, uuid} from 'drizzle-orm/pg-core'

const myTable = pgTable('my_table', {
  id: uuid('id').primaryKey()
})`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/CreateTable/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].severity).toBe('CRITICAL')
      expect(violations[0].message).toContain('pgTable')
      expect(violations[0].message).toContain('schema.ts')
    })

    test('should detect mysqlTable import outside schema.ts', () => {
      const sourceFile = project.createSourceFile('test-mysql-import.ts', `import {mysqlTable} from 'drizzle-orm/mysql-core'`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('mysqlTable')
    })

    test('should detect sqliteTable import outside schema.ts', () => {
      const sourceFile = project.createSourceFile('test-sqlite-import.ts', `import {sqliteTable} from 'drizzle-orm/sqlite-core'`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('sqliteTable')
    })
  })

  describe('detects pgTable() calls outside schema.ts', () => {
    test('should detect pgTable() call in Lambda handler', () => {
      const sourceFile = project.createSourceFile('test-pgtable-call.ts', `const newTable = pgTable('dynamic_table', {
  id: uuid('id').primaryKey()
})`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/DynamicSchema/src/index.ts')

      // Should have at least one violation for the pgTable call
      const pgTableViolations = violations.filter((v) => v.message.includes('pgTable'))
      expect(pgTableViolations.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('detects DDL in sql.raw() calls', () => {
    test('should detect CREATE TABLE in sql.raw()', () => {
      const sourceFile = project.createSourceFile('test-create-table-raw.ts', `import {sql} from 'drizzle-orm'

const createSql = sql.raw('CREATE TABLE users (id uuid PRIMARY KEY)')
await db.execute(createSql)`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/SetupDb/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].severity).toBe('CRITICAL')
      expect(violations[0].message).toContain('CREATE TABLE')
      expect(violations[0].message).toContain('migrations')
    })

    test('should detect ALTER TABLE in sql.raw()', () => {
      const sourceFile = project.createSourceFile('test-alter-table-raw.ts', `const alterSql = sql.raw('ALTER TABLE users ADD COLUMN name text')`, {
        overwrite: true
      })

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/ModifySchema/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('ALTER TABLE')
    })

    test('should detect DROP TABLE in sql.raw()', () => {
      const sourceFile = project.createSourceFile('test-drop-table-raw.ts', `const dropSql = sql.raw('DROP TABLE old_table')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/Cleanup/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('DROP TABLE')
    })

    test('should detect CREATE INDEX in sql.raw()', () => {
      const sourceFile = project.createSourceFile('test-create-index-raw.ts', `const indexSql = sql.raw('CREATE INDEX idx_email ON users(email)')`, {
        overwrite: true
      })

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/CreateIndex/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('CREATE INDEX')
    })

    test('should detect DROP INDEX in sql.raw()', () => {
      const sourceFile = project.createSourceFile('test-drop-index-raw.ts', `sql.raw('DROP INDEX idx_old')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/DropIndex/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('DROP INDEX')
    })

    test('should detect ADD COLUMN in sql.raw()', () => {
      const sourceFile = project.createSourceFile('test-add-column-raw.ts', `sql.raw('ALTER TABLE users ADD COLUMN age integer')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/AddColumn/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      // ALTER TABLE is detected (contains ADD COLUMN operation)
      expect(violations[0].message).toContain('ALTER TABLE')
    })

    test('should detect DROP COLUMN in sql.raw()', () => {
      const sourceFile = project.createSourceFile('test-drop-column-raw.ts', `sql.raw('ALTER TABLE users DROP COLUMN old_field')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/DropColumn/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      // ALTER TABLE is detected (contains DROP COLUMN operation)
      expect(violations[0].message).toContain('ALTER TABLE')
    })

    test('should detect TRUNCATE in sql.raw()', () => {
      const sourceFile = project.createSourceFile('test-truncate-raw.ts', `sql.raw('TRUNCATE TABLE old_data')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/TruncateData/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('TRUNCATE')
    })
  })

  describe('detects DDL in template literals', () => {
    test('should detect CREATE TABLE in template literal executed by db', () => {
      const sourceFile = project.createSourceFile('test-template-create.ts', `const tableName = 'dynamic'
db.execute(\`CREATE TABLE \${tableName} (id uuid PRIMARY KEY)\`)`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/DynamicSetup/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('CREATE TABLE')
    })

    test('should detect ALTER TABLE in template literal with sql tag', () => {
      const sourceFile = project.createSourceFile('test-template-alter.ts', `const col = 'name'
sql(\`ALTER TABLE users ADD COLUMN \${col} text\`)`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/ModifyTable/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('ALTER TABLE')
    })
  })

  describe('detects DDL in string literals', () => {
    test('should detect CREATE TABLE string in execute call', () => {
      const sourceFile = project.createSourceFile('test-string-create.ts', `await db.execute('CREATE TABLE temp_table (id int)')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/TempTable/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('CREATE TABLE')
    })

    test('should detect ALTER TABLE string in sql call', () => {
      const sourceFile = project.createSourceFile('test-string-alter.ts', `sql('ALTER TABLE users ADD COLUMN status text')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/AddStatus/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('ALTER TABLE')
    })
  })

  describe('allows valid patterns', () => {
    test('should allow SELECT statements', () => {
      const sourceFile = project.createSourceFile('test-select.ts', `const result = await db.execute(sql.raw('SELECT * FROM users'))`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/ListUsers/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow INSERT statements', () => {
      const sourceFile = project.createSourceFile('test-insert.ts', `await db.execute(sql.raw('INSERT INTO users (id) VALUES ($1)'))`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/CreateUser/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow UPDATE statements', () => {
      const sourceFile = project.createSourceFile('test-update.ts', `await db.execute(sql.raw('UPDATE users SET name = $1 WHERE id = $2'))`, {
        overwrite: true
      })

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/UpdateUser/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow DELETE statements', () => {
      const sourceFile = project.createSourceFile('test-delete.ts', `await db.execute(sql.raw('DELETE FROM users WHERE id = $1'))`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/DeleteUser/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow drizzle-orm imports without schema types', () => {
      const sourceFile = project.createSourceFile('test-drizzle-imports.ts', `import {sql, eq, and} from 'drizzle-orm'
import {users} from '#lib/vendor/Drizzle/schema'`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/QueryUsers/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow importing schema from schema.ts', () => {
      const sourceFile = project.createSourceFile('test-import-schema.ts', `import {users, files} from '#lib/vendor/Drizzle/schema'
import {db} from '#lib/vendor/Drizzle/client'

const result = await db.select().from(users)`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/ListUsers/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow non-DDL SQL with table-like keywords in data', () => {
      const sourceFile = project.createSourceFile('test-safe-table-reference.ts', `// Table name reference is fine
const query = sql.raw("SELECT * FROM information_schema.tables WHERE table_name = 'users'")`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/ListTables/src/index.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest moving table definitions to schema.ts', () => {
      const sourceFile = project.createSourceFile('test-suggestion-schema.ts', `import {pgTable} from 'drizzle-orm/pg-core'`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toBeDefined()
      expect(violations[0].suggestion).toContain('schema.ts')
    })

    test('should suggest using migrations for DDL', () => {
      const sourceFile = project.createSourceFile('test-suggestion-migrations.ts', `sql.raw('CREATE TABLE test (id int)')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toBeDefined()
      expect(violations[0].suggestion).toContain('migration')
    })

    test('should include code snippet in violation', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', `sql.raw('ALTER TABLE users ADD COLUMN test text')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].codeSnippet).toBeDefined()
      expect(violations[0].codeSnippet).toContain('ALTER TABLE')
    })
  })

  describe('handles multiple violations', () => {
    test('should detect multiple DDL statements', () => {
      const sourceFile = project.createSourceFile('test-multiple-ddl.ts', `sql.raw('CREATE TABLE a (id int)')
sql.raw('ALTER TABLE a ADD COLUMN name text')
sql.raw('CREATE INDEX idx ON a(name)')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/MultiDDL/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(3)
    })

    test('should detect import and call violations separately', () => {
      const sourceFile = project.createSourceFile('test-import-and-call.ts', `import {pgTable, text} from 'drizzle-orm/pg-core'

const table = pgTable('test', {
  name: text('name')
})`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/BothViolations/src/index.ts')

      // Should have violations for both import and call
      expect(violations.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('edge cases', () => {
    test('should handle case-insensitive DDL detection', () => {
      const sourceFile = project.createSourceFile('test-case-insensitive.ts', `sql.raw('create table lowercase (id int)')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('CREATE TABLE')
    })

    test('should not flag files in test directories', () => {
      const sourceFile = project.createSourceFile('test-in-test-dir.ts', `import {pgTable} from 'drizzle-orm/pg-core'
sql.raw('CREATE TABLE test (id int)')`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'test/helpers/schema-helpers.ts')

      expect(violations).toHaveLength(0)
    })

    test('should handle nested path for schema.ts', () => {
      const sourceFile = project.createSourceFile('test-nested-schema.ts', `import {pgTable} from 'drizzle-orm/pg-core'

export const table = pgTable('test', {})`, {overwrite: true})

      const violations = migrationsSafetyRule.validate(sourceFile, 'lib/vendor/Drizzle/schema.ts')

      expect(violations).toHaveLength(0)
    })
  })
})
