/**
 * migrations-safety
 * CRITICAL: Schema changes must only occur in migrations, not in application code
 *
 * Mirrors: src/mcp/validation/rules/migrations-safety.ts
 *
 * This enforces "Migrations as Single Source of Truth" - a zero-tolerance convention
 * per project standards. Schema definitions belong in src/lib/vendor/Drizzle/schema.ts
 * and DDL statements belong in migrations/*.sql files only.
 *
 * Detects:
 * - pgTable/mysqlTable/sqliteTable imports outside schema.ts
 * - DDL keywords (CREATE TABLE, ALTER TABLE, etc.) in template literals
 */

const SCHEMA_IMPORTS = ['pgTable', 'mysqlTable', 'sqliteTable']

const DDL_KEYWORDS = [
  'CREATE TABLE',
  'ALTER TABLE',
  'DROP TABLE',
  'CREATE INDEX',
  'DROP INDEX',
  'ADD COLUMN',
  'DROP COLUMN',
  'RENAME TABLE',
  'TRUNCATE'
]

function containsDDL(text) {
  const upperText = text.toUpperCase()
  for (const keyword of DDL_KEYWORDS) {
    if (upperText.includes(keyword)) {
      return keyword
    }
  }
  return null
}

function isSchemaFile(filename) {
  return filename.includes('lib/vendor/Drizzle/schema.ts') || filename.endsWith('schema.ts')
}

function isMigrationRunner(filename) {
  return filename.includes('lambdas/MigrateDSQL')
}

function isTestFile(filename) {
  return filename.includes('.test.ts') || filename.includes('.test.js') || filename.startsWith('test/') || filename.includes('/test/')
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow schema changes outside migrations and schema.ts',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      schemaImport: "Schema table definition import '{{import}}' detected outside schema.ts. Move table definitions to src/lib/vendor/Drizzle/schema.ts.",
      ddlDetected: "DDL statement '{{keyword}}' detected in application code. Schema changes must be in migrations/*.sql files only."
    },
    schema: []
  },
  create(context) {
    const filename = context.filename || context.getFilename()

    // Allow schema.ts - that's where definitions belong
    if (isSchemaFile(filename)) {
      return {}
    }

    // Allow migration runner Lambda - it executes migrations
    if (isMigrationRunner(filename)) {
      return {}
    }

    // Skip test files - DDL in tests is for setup purposes
    if (isTestFile(filename)) {
      return {}
    }

    return {
      // Check for schema table definition imports (pgTable, etc.)
      ImportDeclaration(node) {
        const moduleSpecifier = node.source.value

        // Check for drizzle-orm/pg-core or similar schema imports
        if (moduleSpecifier.includes('drizzle-orm') && moduleSpecifier.includes('-core')) {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportSpecifier') {
              const importName = specifier.imported.name
              if (SCHEMA_IMPORTS.includes(importName)) {
                context.report({
                  node: specifier,
                  messageId: 'schemaImport',
                  data: {
                    import: importName
                  }
                })
              }
            }
          }
        }
      },

      // Check template literals for DDL keywords
      TemplateLiteral(node) {
        // Get the full text of the template literal
        const quasis = node.quasis.map((q) => q.value.raw).join('')
        const ddlKeyword = containsDDL(quasis)

        if (ddlKeyword) {
          context.report({
            node,
            messageId: 'ddlDetected',
            data: {
              keyword: ddlKeyword
            }
          })
        }
      },

      // Check string literals for DDL keywords in function calls
      CallExpression(node) {
        const callee = node.callee

        // Check for sql.raw(), sql(), db.execute() patterns
        const isRelevantCall =
          (callee.type === 'MemberExpression' &&
            ((callee.object.name === 'sql' && callee.property.name === 'raw') ||
              (callee.object.name === 'db' && callee.property.name === 'execute') ||
              callee.property.name === 'raw')) ||
          (callee.type === 'Identifier' && callee.name === 'sql')

        if (isRelevantCall && node.arguments.length > 0) {
          const arg = node.arguments[0]

          // Check string literal arguments
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            const ddlKeyword = containsDDL(arg.value)
            if (ddlKeyword) {
              context.report({
                node: arg,
                messageId: 'ddlDetected',
                data: {
                  keyword: ddlKeyword
                }
              })
            }
          }

          // Check template literal arguments
          if (arg.type === 'TemplateLiteral') {
            const quasis = arg.quasis.map((q) => q.value.raw).join('')
            const ddlKeyword = containsDDL(quasis)
            if (ddlKeyword) {
              context.report({
                node: arg,
                messageId: 'ddlDetected',
                data: {
                  keyword: ddlKeyword
                }
              })
            }
          }
        }
      }
    }
  }
}
