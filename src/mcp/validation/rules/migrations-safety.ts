/**
 * Migrations Safety Rule
 * CRITICAL: Schema changes must only occur in migrations, not in application code
 *
 * This enforces "Migrations as Single Source of Truth" - a zero-tolerance convention
 * per project standards. Schema definitions belong in src/lib/vendor/Drizzle/schema.ts
 * and DDL statements belong in migrations/*.sql files only.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'migrations-safety'
const SEVERITY = 'CRITICAL' as const

/**
 * DDL keywords that indicate schema changes
 */
const DDL_KEYWORDS = ['CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX', 'DROP INDEX', 'ADD COLUMN', 'DROP COLUMN', 'RENAME TABLE', 'TRUNCATE']

/**
 * Schema definition imports that should only be in schema.ts
 */
const SCHEMA_IMPORTS = ['pgTable', 'mysqlTable', 'sqliteTable']

/**
 * Allowed locations for schema definitions
 */
const SCHEMA_ALLOWED_PATHS = ['src/lib/vendor/Drizzle/schema.ts', 'lib/vendor/Drizzle/schema.ts']

/**
 * Paths where DDL execution is allowed (migration runner)
 */
const MIGRATION_RUNNER_PATHS = ['src/lambdas/MigrateDSQL/', 'lambdas/MigrateDSQL/']

function isSchemaFile(filePath: string): boolean {
  return SCHEMA_ALLOWED_PATHS.some((allowed) => filePath.includes(allowed) || filePath.endsWith(allowed.replace('src/', '')))
}

function isMigrationRunner(filePath: string): boolean {
  return MIGRATION_RUNNER_PATHS.some((allowed) => filePath.includes(allowed))
}

function isTestFile(filePath: string): boolean {
  return filePath.includes('.test.ts') || filePath.startsWith('test/') || filePath.includes('/test/')
}

function containsDDL(text: string): string | null {
  const upperText = text.toUpperCase()
  for (const keyword of DDL_KEYWORDS) {
    if (upperText.includes(keyword)) {
      return keyword
    }
  }
  return null
}

export const migrationsSafetyRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Schema changes must occur in migrations only. Table definitions belong in schema.ts, DDL belongs in migrations/*.sql.',
  severity: SEVERITY,
  appliesTo: ['src/**/*.ts'],
  excludes: ['src/**/*.test.ts', 'test/**/*.ts', 'src/lib/vendor/Drizzle/schema.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Skip schema.ts - that's where definitions belong
    if (isSchemaFile(filePath)) {
      return violations
    }

    // Skip migration runner Lambda - it executes migrations
    if (isMigrationRunner(filePath)) {
      return violations
    }

    // Skip test files - DDL in tests is for setup purposes
    if (isTestFile(filePath)) {
      return violations
    }

    // Check 1: Detect schema table definition imports (pgTable, etc.) outside schema.ts
    const imports = sourceFile.getImportDeclarations()
    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue()

      // Check for drizzle-orm/pg-core or similar schema imports
      if (moduleSpecifier.includes('drizzle-orm') && moduleSpecifier.includes('-core')) {
        const namedImports = importDecl.getNamedImports()
        for (const namedImport of namedImports) {
          const importName = namedImport.getName()
          if (SCHEMA_IMPORTS.includes(importName)) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, importDecl.getStartLineNumber(),
                `Table definition import '${importName}' detected outside schema.ts. Table definitions must be in src/lib/vendor/Drizzle/schema.ts.`, {
                suggestion: 'Move table definition to src/lib/vendor/Drizzle/schema.ts and import from there',
                codeSnippet: importDecl.getText().substring(0, 100)
              })
            )
          }
        }
      }
    }

    // Check 2: Detect pgTable() calls outside schema.ts
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    for (const call of callExpressions) {
      const expression = call.getExpression()
      const expressionText = expression.getText()

      // Check for pgTable(), mysqlTable(), etc.
      if (SCHEMA_IMPORTS.some((fn) => expressionText === fn || expressionText.endsWith(`.${fn}`))) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, call.getStartLineNumber(),
            `Table definition '${expressionText}()' detected outside schema.ts. All table definitions must be in src/lib/vendor/Drizzle/schema.ts.`, {
            suggestion: 'Move this table definition to src/lib/vendor/Drizzle/schema.ts',
            codeSnippet: call.getText().substring(0, 100)
          })
        )
      }

      // Check 3: Detect sql.raw() or sql() with DDL keywords
      if (expressionText === 'sql.raw' || expressionText === 'sql' || expressionText.endsWith('.raw')) {
        const args = call.getArguments()
        if (args.length > 0) {
          const argText = args[0].getText()
          const ddlKeyword = containsDDL(argText)
          if (ddlKeyword) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, call.getStartLineNumber(),
                `DDL statement '${ddlKeyword}' detected in application code. Schema changes must be in migrations/*.sql files only.`, {
                suggestion:
                  'Create a new migration file in migrations/ directory for schema changes. Use pnpm run db:generate to create migrations from schema.ts changes.',
                codeSnippet: call.getText().substring(0, 150)
              })
            )
          }
        }
      }
    }

    // Check 4: Detect template literals containing DDL
    const templateLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.TemplateExpression)
    for (const template of templateLiterals) {
      const text = template.getText()
      const ddlKeyword = containsDDL(text)
      if (ddlKeyword) {
        // Check if this is inside an execute() or sql() call
        const parent = template.getParent()
        if (parent) {
          const parentText = parent.getText()
          if (parentText.includes('execute') || parentText.includes('sql') || parentText.includes('query')) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, template.getStartLineNumber(),
                `DDL statement '${ddlKeyword}' detected in template literal. Schema changes must be in migrations/*.sql files only.`, {
                suggestion: 'Create a new migration file in migrations/ directory for schema changes',
                codeSnippet: text.substring(0, 150)
              })
            )
          }
        }
      }
    }

    // Check 5: Detect string literals with DDL in execute contexts
    const stringLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
    for (const literal of stringLiterals) {
      const text = literal.getText()
      const ddlKeyword = containsDDL(text)
      if (ddlKeyword) {
        // Check for both direct parent CallExpression and nested parent CallExpression
        const parent = literal.getParent()
        let callExpr = parent?.asKind(SyntaxKind.CallExpression) || parent?.getParentIfKind(SyntaxKind.CallExpression)

        // Also check grandparent if not found
        if (!callExpr && parent) {
          callExpr = parent.getParent()?.asKind(SyntaxKind.CallExpression)
        }

        if (callExpr) {
          const callText = callExpr.getExpression().getText()
          if (callText.includes('execute') || callText.includes('sql') || callText.includes('raw')) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, literal.getStartLineNumber(),
                `DDL statement '${ddlKeyword}' detected in string literal. Schema changes must be in migrations/*.sql files only.`, {
                suggestion: 'Create a new migration file in migrations/ directory for schema changes',
                codeSnippet: text.substring(0, 150)
              })
            )
          }
        }
      }
    }

    return violations
  }
}
