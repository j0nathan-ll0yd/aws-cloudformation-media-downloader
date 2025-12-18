/**
 * Import Order Rule
 * MEDIUM: Imports should be grouped and ordered consistently
 *
 * Order: aws-lambda types → entities → vendor → types → utilities
 */

import type {SourceFile} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'import-order'
const SEVERITY = 'MEDIUM' as const

/**
 * Import categories in expected order
 */
const IMPORT_CATEGORIES = [
  {name: 'node-builtins', patterns: [/^node:/, /^fs$/, /^path$/, /^url$/]},
  {name: 'aws-lambda-types', patterns: [/^aws-lambda$/]},
  {name: 'external-packages', patterns: [/^[^#./]/, /^@[^/]+\//]},
  {name: 'entities', patterns: [/#entities\//, /src\/entities\//]},
  {name: 'vendor', patterns: [/#lib\/vendor\//, /src\/lib\/vendor\//]},
  {name: 'types', patterns: [/#types\//, /src\/types\//]},
  {name: 'utilities', patterns: [/#util\//, /src\/util\//]},
  {name: 'relative', patterns: [/^\.\//]}
]

function categorizeImport(moduleSpecifier: string): string {
  for (const category of IMPORT_CATEGORIES) {
    if (category.patterns.some((p) => p.test(moduleSpecifier))) {
      return category.name
    }
  }
  return 'unknown'
}

function getCategoryIndex(category: string): number {
  const index = IMPORT_CATEGORIES.findIndex((c) => c.name === category)
  return index === -1 ? IMPORT_CATEGORIES.length : index
}

export const importOrderRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Imports should be grouped in order: node builtins → aws-lambda types → external packages → entities → vendor → types → utilities → relative',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/**/src/*.ts'],
  excludes: ['**/*.test.ts', 'test/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Only check Lambda handler files
    if (!filePath.includes('/lambdas/') || !filePath.endsWith('/src/index.ts')) {
      return violations
    }

    const imports = sourceFile.getImportDeclarations()

    if (imports.length < 2) {
      return violations // Not enough imports to check order
    }

    // Analyze import order
    let lastCategory = ''
    let lastCategoryIndex = -1
    const seenCategories: string[] = []

    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue()
      const category = categorizeImport(moduleSpecifier)
      const categoryIndex = getCategoryIndex(category)

      // Check if this category comes before a previously seen category
      if (categoryIndex < lastCategoryIndex && lastCategory !== category) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, importDecl.getStartLineNumber(),
            `Import '${moduleSpecifier}' (${category}) should come before ${lastCategory} imports`, {
            suggestion: `Move this import to the ${category} section at the top`,
            codeSnippet: importDecl.getText().substring(0, 80)
          })
        )
      }

      // Check for mixed categories (same category appearing non-consecutively)
      if (seenCategories.includes(category) && lastCategory !== category) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, importDecl.getStartLineNumber(), `${category} imports should be grouped together`, {
            suggestion: `Group all ${category} imports consecutively`
          })
        )
      }

      if (lastCategory !== category) {
        seenCategories.push(category)
      }
      lastCategory = category
      lastCategoryIndex = categoryIndex
    }

    return violations
  }
}
