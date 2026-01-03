/**
 * Tests for migrations-safety ESLint rule
 *
 * CRITICAL: Schema changes must only occur in migrations, not in application code
 */

const {RuleTester} = require('eslint')
const rule = require('../rules/migrations-safety.cjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
})

ruleTester.run('migrations-safety', rule, {
  valid: [
    // Allowed: schema.ts - pgTable imports are allowed
    {
      code: "import {pgTable, text, uuid} from 'drizzle-orm/pg-core'",
      filename: 'src/lib/vendor/Drizzle/schema.ts'
    },
    // Allowed: schema.ts - table definitions
    {
      code: `import {pgTable} from 'drizzle-orm/pg-core'
const users = pgTable('users', {})`,
      filename: 'lib/vendor/Drizzle/schema.ts'
    },
    // Allowed: migration runner Lambda
    {
      code: "sql.raw('CREATE TABLE users (id uuid PRIMARY KEY)')",
      filename: 'src/lambdas/MigrateDSQL/src/index.ts'
    },
    // Allowed: test files
    {
      code: "sql.raw('CREATE TABLE test_table (id int)')",
      filename: 'src/lambdas/Users/test/index.test.ts'
    },
    // Allowed: test directory
    {
      code: "import {pgTable} from 'drizzle-orm/pg-core'",
      filename: 'test/helpers/schema-mock.ts'
    },
    // Allowed: non-DDL SQL
    {
      code: "sql.raw('SELECT * FROM users')",
      filename: 'src/lambdas/ListUsers/src/index.ts'
    },
    // Allowed: INSERT statement
    {
      code: "db.execute(`INSERT INTO users (id) VALUES ($1)`)",
      filename: 'src/lambdas/CreateUser/src/index.ts'
    },
    // Allowed: UPDATE statement
    {
      code: "sql('UPDATE users SET name = $1 WHERE id = $2')",
      filename: 'src/lambdas/UpdateUser/src/index.ts'
    },
    // Allowed: DELETE statement
    {
      code: "sql.raw('DELETE FROM users WHERE id = $1')",
      filename: 'src/lambdas/DeleteUser/src/index.ts'
    },
    // Allowed: regular imports from drizzle-orm (not pg-core)
    {
      code: "import {sql, eq, and} from 'drizzle-orm'",
      filename: 'src/lambdas/ListUsers/src/index.ts'
    },
    // Allowed: importing schema from schema.ts
    {
      code: "import {users, files} from '#lib/vendor/Drizzle/schema'",
      filename: 'src/lambdas/QueryUsers/src/index.ts'
    }
  ],
  invalid: [
    // Forbidden: pgTable import in Lambda
    {
      code: "import {pgTable} from 'drizzle-orm/pg-core'",
      filename: 'src/lambdas/CreateTable/src/index.ts',
      errors: [{messageId: 'schemaImport'}]
    },
    // Forbidden: mysqlTable import outside schema.ts
    {
      code: "import {mysqlTable} from 'drizzle-orm/mysql-core'",
      filename: 'src/lambdas/Test/src/index.ts',
      errors: [{messageId: 'schemaImport'}]
    },
    // Forbidden: sqliteTable import outside schema.ts
    {
      code: "import {sqliteTable} from 'drizzle-orm/sqlite-core'",
      filename: 'src/lambdas/Test/src/index.ts',
      errors: [{messageId: 'schemaImport'}]
    },
    // Forbidden: CREATE TABLE in sql.raw()
    {
      code: "sql.raw('CREATE TABLE users (id uuid PRIMARY KEY)')",
      filename: 'src/lambdas/SetupDb/src/index.ts',
      errors: [{messageId: 'ddlDetected'}]
    },
    // Forbidden: ALTER TABLE in sql.raw()
    {
      code: "sql.raw('ALTER TABLE users ADD COLUMN name text')",
      filename: 'src/lambdas/ModifySchema/src/index.ts',
      errors: [{messageId: 'ddlDetected'}]
    },
    // Forbidden: DROP TABLE in sql.raw()
    {
      code: "sql.raw('DROP TABLE old_table')",
      filename: 'src/lambdas/Cleanup/src/index.ts',
      errors: [{messageId: 'ddlDetected'}]
    },
    // Forbidden: CREATE INDEX in sql()
    {
      code: "sql('CREATE INDEX idx_email ON users(email)')",
      filename: 'src/lambdas/CreateIndex/src/index.ts',
      errors: [{messageId: 'ddlDetected'}]
    },
    // Forbidden: DDL in db.execute()
    {
      code: "db.execute('CREATE TABLE temp (id int)')",
      filename: 'src/lambdas/TempTable/src/index.ts',
      errors: [{messageId: 'ddlDetected'}]
    },
    // Forbidden: DDL in template literal
    {
      code: "const q = `CREATE TABLE ${name} (id int)`",
      filename: 'src/lambdas/DynamicTable/src/index.ts',
      errors: [{messageId: 'ddlDetected'}]
    },
    // Forbidden: TRUNCATE in application code
    {
      code: "sql.raw('TRUNCATE TABLE old_data')",
      filename: 'src/lambdas/TruncateData/src/index.ts',
      errors: [{messageId: 'ddlDetected'}]
    },
    // Forbidden: multiple schema imports (each is reported)
    {
      code: "import {pgTable, text, uuid} from 'drizzle-orm/pg-core'",
      filename: 'src/lambdas/BadHandler/src/index.ts',
      errors: [{messageId: 'schemaImport'}]
    }
  ]
})

console.log('migrations-safety: All tests passed!')
