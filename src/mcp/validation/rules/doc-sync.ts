/**
 * Documentation Sync Rule
 * HIGH: Validates that code patterns match documented expectations
 *
 * This rule helps detect when source code drifts from documentation:
 * - Entity file count in src/entities matches AGENTS.md project structure
 * - Lambda directories match trigger table
 * - MCP rule count matches registered rules
 *
 * Note: This is complementary to bin/validate-doc-sync.sh which performs
 * filesystem-level validation. This rule validates TypeScript files for
 * patterns that indicate documentation may be stale.
 *
 * @see docs/doc-code-mapping.json
 * @see Issue #145: Living Documentation System
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'doc-sync'
const SEVERITY = 'HIGH' as const

/**
 * Expected counts from documentation (updated when docs change)
 * These are validated by bin/validate-doc-sync.sh against filesystem
 */
const EXPECTED_COUNTS = {
  // Entity files in src/entities (excluding index.ts and test files)
  entities: 10,
  // Lambda directories in src/lambdas
  lambdas: 16,
  // MCP validation rules in src/mcp/validation/rules (including this rule)
  mcpRules: 20
}

/**
 * Required vendor paths that must exist (documented in AGENTS.md)
 */
const REQUIRED_VENDOR_PATHS = [
  'src/lib/vendor/AWS',
  'src/lib/vendor/BetterAuth',
  'src/lib/vendor/Drizzle',
  'src/lib/vendor/OpenTelemetry',
  'src/lib/vendor/Powertools',
  'src/lib/vendor/YouTube'
]

/**
 * Patterns that should not appear in source code (stale references)
 */
const STALE_PATTERNS = [
  {pattern: /from ['"]lib\/vendor\//g, replacement: "from 'src/lib/vendor/", description: 'Old vendor path without src/ prefix'},
  {pattern: /import.*Prettier/gi, replacement: 'dprint', description: 'Prettier reference (project uses dprint)'}
]

export const docSyncRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Validates source code patterns match documentation expectations. Detects stale imports and configuration drift.',
  severity: SEVERITY,
  appliesTo: [
    'src/**/*.ts',
    'AGENTS.md',
    'docs/**/*.md'
  ],
  excludes: ['**/*.test.ts', '**/node_modules/**', 'src/mcp/validation/rules/doc-sync.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // For TypeScript files, check for stale import patterns
    if (filePath.endsWith('.ts')) {
      violations.push(...validateTypeScriptPatterns(sourceFile, filePath))
    }

    // For the MCP validation index, verify rule count matches
    if (filePath === 'src/mcp/validation/index.ts') {
      violations.push(...validateMcpRuleCount(sourceFile))
    }

    return violations
  }
}

/**
 * Validate TypeScript files for stale patterns
 */
function validateTypeScriptPatterns(sourceFile: SourceFile, filePath: string): Violation[] {
  // filePath available for context if needed
  void filePath
  const violations: Violation[] = []
  const text = sourceFile.getFullText()

  // Check for stale import patterns
  for (const {pattern, replacement, description} of STALE_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) {
      const lineNumber = findLineNumber(text, pattern)
      violations.push(
        createViolation(RULE_NAME, SEVERITY, lineNumber, `Stale pattern detected: ${description}`, {
          suggestion: `Replace with ${replacement}`,
          codeSnippet: matches[0]
        })
      )
    }
  }

  // Check for imports from non-existent vendor paths
  const importDeclarations = sourceFile.getImportDeclarations()
  for (const importDecl of importDeclarations) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue()

    // Check if it's a vendor import
    if (moduleSpecifier.includes('lib/vendor/')) {
      // Validate the vendor path exists
      const vendorMatch = moduleSpecifier.match(/lib\/vendor\/(\w+)/)
      if (vendorMatch) {
        const vendorName = vendorMatch[1]
        const expectedPath = `src/lib/vendor/${vendorName}`

        // Check if any required vendor path matches
        const matchesRequired = REQUIRED_VENDOR_PATHS.some((p) => p.includes(vendorName))
        if (!matchesRequired) {
          violations.push(
            createViolation(RULE_NAME, 'MEDIUM', importDecl.getStartLineNumber(), `Import from undocumented vendor path: ${moduleSpecifier}`, {
              suggestion: `Verify vendor path exists and is documented in AGENTS.md: ${expectedPath}`
            })
          )
        }
      }
    }
  }

  return violations
}

/**
 * Validate MCP rule count in index.ts
 */
function validateMcpRuleCount(sourceFile: SourceFile): Violation[] {
  const violations: Violation[] = []

  // Count rule exports in allRules array
  const allRulesArray = sourceFile.getVariableDeclaration('allRules')
  if (allRulesArray) {
    const initializer = allRulesArray.getInitializer()
    if (initializer?.getKind() === SyntaxKind.ArrayLiteralExpression) {
      const arrayLiteral = initializer.asKind(SyntaxKind.ArrayLiteralExpression)
      const elementCount = arrayLiteral?.getElements().length || 0

      if (elementCount !== EXPECTED_COUNTS.mcpRules) {
        violations.push(
          createViolation(RULE_NAME, 'MEDIUM', allRulesArray.getStartLineNumber(),
            `MCP rule count mismatch: allRules has ${elementCount} rules, expected ${EXPECTED_COUNTS.mcpRules}`, {
            suggestion:
              `Update EXPECTED_COUNTS.mcpRules in doc-sync.ts to ${elementCount} if this is intentional, or update docs/wiki/MCP/Convention-Tools.md`
          })
        )
      }
    }
  }

  return violations
}

/**
 * Find line number for a regex pattern match
 */
function findLineNumber(text: string, pattern: RegExp): number {
  const match = text.match(pattern)
  if (!match || match.index === undefined) {
    return 1
  }
  return text.substring(0, match.index).split('\n').length
}

/**
 * Auto-fix suggestion generator
 * Returns shell commands to help diagnose and fix issues
 */
export function generateAutoFixSuggestions(violations: Violation[]): string[] {
  const suggestions: string[] = []
  for (const violation of violations) {
    if (violation.rule !== RULE_NAME) {
      continue
    }

    if (violation.message.includes('Entity count')) {
      suggestions.push('# List current entities:')
      suggestions.push("find src/entities -name '*.ts' ! -name '*.test.ts' ! -name 'index.ts' -exec basename {} \\;")
      suggestions.push('')
    }

    if (violation.message.includes('Lambda count')) {
      suggestions.push('# List current Lambdas:')
      suggestions.push('find src/lambdas -mindepth 1 -maxdepth 1 -type d -exec basename {} \\;')
      suggestions.push('')
    }

    if (violation.message.includes('MCP rule count')) {
      suggestions.push('# List current MCP rules:')
      suggestions.push("find src/mcp/validation/rules -name '*.ts' ! -name '*.test.ts' ! -name 'index.ts' ! -name 'types.ts' -exec basename {} \\;")
      suggestions.push('')
    }

    if (violation.message.includes('vendor path')) {
      suggestions.push('# Fix vendor imports:')
      suggestions.push("grep -r \"lib/vendor/\" src/ --include='*.ts' | grep -v 'src/lib/vendor'")
      suggestions.push('')
    }

    if (violation.message.includes('GraphRAG')) {
      suggestions.push('# Regenerate GraphRAG:')
      suggestions.push('pnpm run graphrag:extract')
      suggestions.push('')
    }
  }
  return suggestions
}
