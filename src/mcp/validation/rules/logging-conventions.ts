/**
 * Logging Conventions Rule
 * MEDIUM: Validates consistent logging message patterns
 *
 * This rule enforces the conventions documented in docs/wiki/Conventions/Logging-Conventions.md:
 * - Function entry/exit should use arrow notation (\<=, =\>)
 * - Response logging should use =\> not ==
 * - No dotted message patterns like func.nested.path
 *
 * @see docs/wiki/Conventions/Logging-Conventions.md
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'logging-conventions'
const SEVERITY = 'MEDIUM' as const

/** Pattern to detect response == (should be response =\>) */
const RESPONSE_DOUBLE_EQUALS_PATTERN = /['"]response\s*==['"]|['"]response\s*==$/

/** Pattern to detect dotted message patterns like func.nested.path */
const DOTTED_MESSAGE_PATTERN = /^['"][\w]+\.[\w.]+\s*<=/

export const loggingConventionsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Validates consistent logging message patterns (arrow notation, no == for response)',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/**/src/index.ts', 'src/lib/**/*.ts', 'src/entities/**/*.ts', 'src/util/*.ts'],
  excludes: ['**/*.test.ts', '**/node_modules/**', 'src/mcp/**/*.ts', '**/*.fixture.ts'],

  validate(sourceFile: SourceFile): Violation[] {
    const violations: Violation[] = []

    // Find all call expressions (function calls)
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const callExpr of callExpressions) {
      const expression = callExpr.getExpression()
      const exprText = expression.getText()

      // Only check logDebug, logInfo, logError calls
      if (!['logDebug', 'logInfo', 'logError'].includes(exprText)) {
        continue
      }

      const args = callExpr.getArguments()
      if (args.length === 0) {
        continue
      }

      const firstArg = args[0]
      const argText = firstArg.getText()
      const line = callExpr.getStartLineNumber()

      // Check 1: Detect response == pattern (should be response =>)
      if (RESPONSE_DOUBLE_EQUALS_PATTERN.test(argText)) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, line, `Use 'response =>' instead of 'response ==' for consistency`, {
            suggestion: "Change 'response ==' to 'response =>' to match the entry/exit arrow convention",
            codeSnippet: callExpr.getText().substring(0, 80)
          })
        )
      }

      // Check 2: Detect dotted message patterns like getPayloadFromEvent.event.body
      if (DOTTED_MESSAGE_PATTERN.test(argText)) {
        // Extract the dotted path
        const pathMatch = argText.match(/^['"]?([\w.]+)/)
        const dottedPath = pathMatch ? pathMatch[1] : argText

        violations.push(
          createViolation(RULE_NAME, SEVERITY, line, `Avoid dotted message patterns: ${dottedPath}`, {
            suggestion: 'Use camelCase function name without dots. E.g., "functionName <=" instead of "func.nested.path <="',
            codeSnippet: callExpr.getText().substring(0, 80)
          })
        )
      }
    }

    return violations
  }
}
