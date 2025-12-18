/**
 * Response Enum Rule
 * MEDIUM: Detect magic strings in API responses
 *
 * This rule enforces using ResponseStatus enum instead of
 * string literals for consistent API response status values.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'response-enum'
const SEVERITY = 'MEDIUM' as const

/**
 * Magic strings that should use ResponseStatus enum
 */
const MAGIC_STATUS_STRINGS = ['success', 'error', 'fail', 'failed', 'ok', 'pending', 'complete', 'completed']

export const responseEnumRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Use ResponseStatus enum instead of magic strings for API response status values.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/**/src/*.ts'],
  excludes: ['src/**/*.test.ts', 'test/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    // filePath available for context if needed
    void filePath
    const violations: Violation[] = []

    // Find all string literals
    const stringLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)

    for (const literal of stringLiterals) {
      const value = literal.getLiteralValue().toLowerCase()

      // Check if this is a magic status string
      if (MAGIC_STATUS_STRINGS.includes(value)) {
        // Check context - is this in a response object?
        const parent = literal.getParent()
        if (!parent) {
          continue
        }

        // Check if part of a property assignment like { status: 'success' }
        if (parent.getKind() === SyntaxKind.PropertyAssignment) {
          const propAssign = parent.asKind(SyntaxKind.PropertyAssignment)
          const propName = propAssign?.getName()

          // Only flag if the property is 'status' or similar
          if (propName === 'status' || propName === 'state' || propName === 'result') {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, literal.getStartLineNumber(),
                `Magic string '${value}' used for ${propName}. Use ResponseStatus enum instead.`, {
                suggestion: `Import ResponseStatus from '#types/main' and use ResponseStatus.${capitalize(value)}`,
                codeSnippet: parent.getText()
              })
            )
          }
        }

        // Check if in response() call
        const grandParent = parent.getParent()
        if (grandParent?.getText().includes('response(')) {
          // Look for status property in the response data
          const responseText = grandParent.getText()
          if (responseText.includes(`status`) && responseText.includes(`'${literal.getLiteralValue()}'`)) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, literal.getStartLineNumber(), `Magic string '${value}' in response. Use ResponseStatus enum.`, {
                suggestion: `Import ResponseStatus from '#types/main' and use ResponseStatus.${capitalize(value)}`,
                codeSnippet: responseText.substring(0, 80)
              })
            )
          }
        }
      }
    }

    return violations
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
