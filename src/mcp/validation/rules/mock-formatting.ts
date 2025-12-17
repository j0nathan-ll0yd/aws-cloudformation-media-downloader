/**
 * Mock Formatting Rule
 * MEDIUM: Detect chained mock return value patterns
 *
 * This rule enforces using separate statements for sequential
 * mockResolvedValueOnce/mockReturnValueOnce calls for better readability.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation, ValidationRule, Violation} from '../types'

const RULE_NAME = 'mock-formatting'
const SEVERITY = 'MEDIUM' as const

/**
 * Mock methods that are often chained
 */
const CHAINABLE_MOCK_METHODS = ['mockResolvedValueOnce', 'mockReturnValueOnce', 'mockRejectedValueOnce', 'mockImplementationOnce']

export const mockFormattingRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Use separate statements instead of chaining for mockResolvedValueOnce/mockReturnValueOnce sequences.',
  severity: SEVERITY,
  appliesTo: ['src/**/*.test.ts', 'test/**/*.ts'],
  excludes: [],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    // filePath available for context if needed
    void filePath
    const violations: Violation[] = []

    // Find all call expressions
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const call of callExpressions) {
      const callText = call.getText()

      // Count how many chainable methods appear in this expression
      let chainCount = 0
      for (const method of CHAINABLE_MOCK_METHODS) {
        // Count occurrences of each method
        const regex = new RegExp(`\\.${method}\\(`, 'g')
        const matches = callText.match(regex)
        if (matches) {
          chainCount += matches.length
        }
      }

      // If 2+ chainable methods, this is a chained pattern
      if (chainCount >= 2) {
        // Verify this is actually a chain (methods called on same line/expression)
        const expression = call.getExpression()
        if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
          const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression)
          const methodName = propAccess?.getName()

          if (methodName && CHAINABLE_MOCK_METHODS.includes(methodName)) {
            violations.push(
              createViolation(
                RULE_NAME,
                SEVERITY,
                call.getStartLineNumber(),
                `Chained mock return values detected (${chainCount} calls). Use separate statements for readability.`,
                {
                  suggestion: 'Split into separate statements:\nmock.mockResolvedValueOnce(a)\nmock.mockResolvedValueOnce(b)',
                  codeSnippet: callText.substring(0, 100)
                }
              )
            )
          }
        }
      }
    }

    return violations
  }
}
