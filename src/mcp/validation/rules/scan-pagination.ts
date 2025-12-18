/**
 * Scan Pagination Rule
 * HIGH: Detect unpaginated DynamoDB scan operations
 *
 * DynamoDB scans return at most 1MB of data per request.
 * This rule enforces using scanAllPages() for complete results.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'scan-pagination'
const SEVERITY = 'HIGH' as const

/**
 * Pagination wrapper functions
 */
const PAGINATION_WRAPPERS = ['scanAllPages', 'queryAllPages', 'getAllPages']

export const scanPaginationRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Wrap DynamoDB scan operations with scanAllPages() to ensure complete results across pagination boundaries.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/**/src/*.ts'],
  excludes: ['src/**/*.test.ts', 'test/**/*.ts', 'src/util/pagination.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Skip the pagination utility itself
    if (filePath.includes('pagination.ts')) {
      return violations
    }

    // Find all property access expressions that might be scans
    const propertyAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)

    for (const access of propertyAccesses) {
      const propertyName = access.getName()

      // Check for .scan property access
      if (propertyName === 'scan') {
        const parent = access.getParent()
        const fullText = parent?.getText() || access.getText()

        // Check if this is followed by .go() (indicating execution)
        if (fullText.includes('.go(')) {
          // Check if wrapped in pagination helper
          const lineNum = access.getStartLineNumber()
          const lineText = sourceFile.getFullText().split('\n')[lineNum - 1] || ''

          const isWrapped = PAGINATION_WRAPPERS.some((wrapper) => lineText.includes(wrapper) || fullText.includes(wrapper))

          if (!isWrapped) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, lineNum, 'Scan operation without pagination handling. DynamoDB returns max 1MB per request.', {
                suggestion: "Use scanAllPages(Entity.scan) from '#util/pagination' for complete results",
                codeSnippet: fullText.substring(0, 80)
              })
            )
          }
        }
      }
    }

    return violations
  }
}
