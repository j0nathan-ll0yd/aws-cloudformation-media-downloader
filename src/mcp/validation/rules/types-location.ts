/**
 * Type Location Rule
 * HIGH: Exported type definitions should be in src/types/ directory
 *
 * This rule enforces separation of concerns by ensuring types are centralized
 * in the types directory, making them discoverable and maintainable.
 *
 * @see docs/wiki/TypeScript/Type-Definitions.md
 */

import type {SourceFile} from 'ts-morph'
import {createViolation, ValidationRule, Violation} from '../types'

const RULE_NAME = 'types-location'
const SEVERITY = 'HIGH' as const

/**
 * Determine the suggested target file in src/types/ based on the source file
 */
function getSuggestedTypeFile(filePath: string): string {
  // Map common utility files to their type files
  if (filePath.includes('lambda-helpers')) {
    return 'src/types/lambda-wrappers.ts'
  }
  if (filePath.includes('video-error-classifier') || filePath.includes('YouTube')) {
    return 'src/types/video.ts'
  }
  if (filePath.includes('retry') || filePath.includes('better-auth')) {
    return 'src/types/util.ts'
  }

  // For lambdas, suggest a domain-specific type file
  if (filePath.includes('/lambdas/')) {
    const match = filePath.match(/\/lambdas\/([^/]+)\//)
    if (match) {
      return `src/types/${match[1].toLowerCase()}.ts or src/types/main.ts`
    }
  }

  // Default suggestion
  return 'src/types/main.ts or a domain-specific type file in src/types/'
}

export const typesLocationRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Exported type definitions should be in src/types/ directory for discoverability and separation of concerns.',
  severity: SEVERITY,
  appliesTo: ['src/**/*.ts'],
  excludes: [
    'src/types/**/*.ts', // Canonical location for types
    'src/entities/**/*.ts', // Entity-derived types allowed
    'src/mcp/**/*.ts', // MCP types are self-contained
    '**/*.test.ts', // Test files
    'test/**/*.ts', // Test files
    'src/lib/vendor/**/*.ts' // Vendor wrappers may need internal types
  ],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Check for excluded patterns (double-check in case appliesTo/excludes overlap)
    if (
      filePath.includes('src/types/') ||
      filePath.includes('src/entities/') ||
      filePath.includes('src/mcp/') ||
      filePath.includes('/test/') ||
      filePath.startsWith('test/') ||
      filePath.includes('.test.') ||
      filePath.includes('lib/vendor/')
    ) {
      return violations
    }

    // Find exported type aliases
    const typeAliases = sourceFile.getTypeAliases()
    for (const typeAlias of typeAliases) {
      if (typeAlias.isExported()) {
        const name = typeAlias.getName()
        const line = typeAlias.getStartLineNumber()

        violations.push(
          createViolation(RULE_NAME, SEVERITY, line, `Exported type alias '${name}' should be in src/types/`, {
            suggestion: `Move type '${name}' to ${getSuggestedTypeFile(filePath)}`,
            codeSnippet: typeAlias.getText().substring(0, 80)
          })
        )
      }
    }

    // Find exported interfaces
    const interfaces = sourceFile.getInterfaces()
    for (const iface of interfaces) {
      if (iface.isExported()) {
        const name = iface.getName()
        const line = iface.getStartLineNumber()

        violations.push(
          createViolation(RULE_NAME, SEVERITY, line, `Exported interface '${name}' should be in src/types/`, {
            suggestion: `Move interface '${name}' to ${getSuggestedTypeFile(filePath)}`,
            codeSnippet: iface.getText().substring(0, 80)
          })
        )
      }
    }

    // Find exported enums
    const enums = sourceFile.getEnums()
    for (const enumDecl of enums) {
      if (enumDecl.isExported()) {
        const name = enumDecl.getName()
        const line = enumDecl.getStartLineNumber()

        violations.push(
          createViolation(RULE_NAME, SEVERITY, line, `Exported enum '${name}' should be in src/types/`, {
            suggestion: `Move enum '${name}' to ${getSuggestedTypeFile(filePath)}`,
            codeSnippet: enumDecl.getText().substring(0, 80)
          })
        )
      }
    }

    return violations
  }
}
