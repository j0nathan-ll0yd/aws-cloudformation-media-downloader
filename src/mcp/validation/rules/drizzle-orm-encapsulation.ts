/**
 * Drizzle ORM Encapsulation Rule
 * CRITICAL: Never import Drizzle ORM directly - use lib/vendor/Drizzle/ wrappers
 *
 * This is a zero-tolerance rule per project conventions.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'drizzle-orm-encapsulation'
const SEVERITY = 'CRITICAL' as const

/**
 * Vendor packages that should never be imported directly
 */
const FORBIDDEN_PACKAGES = ['drizzle-orm', 'drizzle-orm/', 'drizzle-kit', 'drizzle-zod', 'postgres']

/**
 * Suggested vendor wrapper mappings
 */
const VENDOR_SUGGESTIONS: Record<string, string> = {
  'drizzle-orm': 'lib/vendor/Drizzle/types (for operators like eq, and, or) or lib/vendor/Drizzle/client (for getDrizzleClient)',
  'drizzle-orm/pg-core': 'lib/vendor/Drizzle/schema',
  'drizzle-orm/postgres-js': 'lib/vendor/Drizzle/client',
  'drizzle-zod': 'lib/vendor/Drizzle/zod-schemas (for generated Zod schemas) or lib/vendor/Drizzle (for factory functions)',
  postgres: 'lib/vendor/Drizzle/client (postgres driver is encapsulated there)'
}

function getSuggestion(moduleSpecifier: string): string {
  if (VENDOR_SUGGESTIONS[moduleSpecifier]) {
    return `Import from '${VENDOR_SUGGESTIONS[moduleSpecifier]}' instead`
  }
  for (const [pattern, vendor] of Object.entries(VENDOR_SUGGESTIONS)) {
    if (moduleSpecifier.startsWith(pattern)) {
      return `Import from '${vendor}' instead`
    }
  }
  return 'Create a vendor wrapper in lib/vendor/Drizzle/ for this module'
}

export const drizzleOrmEncapsulationRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Never import Drizzle ORM packages directly. Use lib/vendor/Drizzle/ wrappers for encapsulation, type safety, and testability.',
  severity: SEVERITY,
  appliesTo: ['src/**/*.ts'],
  excludes: ['src/lib/vendor/Drizzle/**/*.ts', 'src/**/*.test.ts', 'test/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Skip vendor directories - that's where direct imports are allowed
    if (filePath.includes('lib/vendor/Drizzle')) {
      return violations
    }

    // Check all import declarations
    const imports = sourceFile.getImportDeclarations()

    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue()

      // Check if this is a forbidden Drizzle import
      const isForbidden = FORBIDDEN_PACKAGES.some((pkg) => moduleSpecifier === pkg || moduleSpecifier.startsWith(pkg + '/'))

      if (isForbidden) {
        const line = importDecl.getStartLineNumber()
        const importText = importDecl.getText()

        violations.push(
          createViolation(RULE_NAME, SEVERITY, line, `Direct Drizzle ORM import forbidden: '${moduleSpecifier}'`, {
            suggestion: getSuggestion(moduleSpecifier),
            codeSnippet: importText.substring(0, 100)
          })
        )
      }
    }

    // Also check dynamic imports
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    for (const call of callExpressions) {
      const expression = call.getExpression()
      if (expression.getText() === 'import') {
        const args = call.getArguments()
        if (args.length > 0) {
          const arg = args[0].getText().replace(/['"]/g, '')
          const isForbidden = FORBIDDEN_PACKAGES.some((pkg) => arg === pkg || arg.startsWith(pkg + '/'))
          if (isForbidden) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, call.getStartLineNumber(), `Dynamic Drizzle ORM import forbidden: '${arg}'`, {
                suggestion: getSuggestion(arg)
              })
            )
          }
        }
      }
    }

    return violations
  }
}
