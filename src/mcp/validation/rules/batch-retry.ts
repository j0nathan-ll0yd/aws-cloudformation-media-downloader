/**
 * Batch Retry Rule
 * HIGH: Detect batch operations without retry handling
 *
 * ElectroDB batch operations can return unprocessed items.
 * This rule enforces using retryUnprocessed() wrapper for reliability.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation, ValidationRule, Violation} from '../types'

const RULE_NAME = 'batch-retry'
const SEVERITY = 'HIGH' as const

/**
 * Batch operation patterns that need retry handling
 */
const BATCH_PATTERNS = ['batchGet', 'batchWrite', 'batchDelete']

/**
 * Allowed wrapper functions that handle retries
 */
const RETRY_WRAPPERS = ['retryUnprocessed', 'retryUnprocessedDelete', 'withRetry']

export const batchRetryRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Wrap DynamoDB batch operations with retryUnprocessed() to handle unprocessed items gracefully.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/**/src/*.ts', 'src/util/*.ts'],
  excludes: ['src/**/*.test.ts', 'test/**/*.ts', 'src/util/retry.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Skip the retry utility itself
    if (filePath.includes('retry.ts')) {
      return violations
    }

    // Find all call expressions
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const call of callExpressions) {
      const callText = call.getText()

      // Check for batch operations
      for (const pattern of BATCH_PATTERNS) {
        if (callText.includes(pattern)) {
          // Check if it's wrapped in a retry function
          const isWrapped = RETRY_WRAPPERS.some((wrapper) => {
            // Look at parent call to see if this is wrapped
            const parent = call.getParent()
            if (parent?.getKind() === SyntaxKind.CallExpression) {
              return parent.getText().includes(wrapper)
            }
            // Also check if the call itself starts with the wrapper
            return callText.startsWith(wrapper)
          })

          // Also check if retryUnprocessed is called on the same line/nearby
          const lineText = sourceFile.getFullText().split('\n')[call.getStartLineNumber() - 1] || ''
          const hasRetryNearby = RETRY_WRAPPERS.some((w) => lineText.includes(w))

          if (!isWrapped && !hasRetryNearby) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, call.getStartLineNumber(), `Batch operation '${pattern}' without retry handling. Wrap with retryUnprocessed() to handle unprocessed items.`, {
                suggestion: `Use retryUnprocessed(${pattern}(...)) from '#util/retry'`,
                codeSnippet: callText.substring(0, 80)
              })
            )
          }
        }
      }
    }

    return violations
  }
}
