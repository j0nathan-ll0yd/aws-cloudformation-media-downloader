/**
 * Environment Variable Validation Rule
 * CRITICAL: Detect direct process.env access without getRequiredEnv() wrapper
 *
 * This enforces the convention that all environment variable access should use
 * the validated helpers from util/env-validation.ts to ensure proper error
 * handling and avoid silent failures from missing environment variables.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation, ValidationRule, Violation} from '../types'

const RULE_NAME = 'env-validation'
const SEVERITY = 'CRITICAL' as const

/**
 * Allowed helper functions for environment variable access
 */
const ALLOWED_HELPERS = ['getRequiredEnv', 'getRequiredEnvNumber', 'getOptionalEnv']

/**
 * Known environment variables that might be accessed directly
 * (used for better error messages)
 */
const KNOWN_ENV_VARS = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'NODE_ENV',
  'DYNAMODB_TABLE_NAME',
  'S3_BUCKET_NAME',
  'APNS_TOPIC',
  'APNS_KEY_ID',
  'APNS_TEAM_ID'
]

export const envValidationRule: ValidationRule = {
  name: RULE_NAME,
  description:
    'Never access process.env directly. Use getRequiredEnv() or getRequiredEnvNumber() from util/env-validation.ts for validated access with proper error handling.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/**/src/*.ts', 'src/util/*.ts'],
  excludes: ['src/**/*.test.ts', 'test/**/*.ts', 'src/util/env-validation.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Skip the env-validation utility itself
    if (filePath.includes('env-validation.ts')) {
      return violations
    }

    // Find all property access expressions
    const propertyAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)

    for (const access of propertyAccesses) {
      const expression = access.getExpression()
      const property = access.getName()

      // Check for process.env.X pattern
      if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const innerAccess = expression.asKind(SyntaxKind.PropertyAccessExpression)
        if (innerAccess) {
          const innerExpr = innerAccess.getExpression()
          const innerProp = innerAccess.getName()

          if (innerExpr.getText() === 'process' && innerProp === 'env') {
            // This is process.env.SOMETHING
            const line = access.getStartLineNumber()
            const envVar = property
            const codeSnippet = access.getText()

            // Check if it's inside a getRequiredEnv call (allowed)
            const parent = access.getParent()
            const isInsideHelper = parent && ALLOWED_HELPERS.some((helper) => parent.getText().includes(`${helper}(`))

            if (!isInsideHelper) {
              const suggestion = KNOWN_ENV_VARS.includes(envVar)
                ? `Use getRequiredEnv('${envVar}') from '#util/env-validation'`
                : `Use getRequiredEnv('${envVar}') or getOptionalEnv('${envVar}') from '#util/env-validation'`

              violations.push(
                createViolation(RULE_NAME, SEVERITY, line, `Direct process.env access: '${envVar}'. Use validated helper instead.`, {
                  suggestion,
                  codeSnippet
                })
              )
            }
          }
        }
      }

      // Also check for process.env['X'] pattern (element access)
      if (expression.getText() === 'process.env') {
        const parent = access.getParent()
        if (parent?.getKind() === SyntaxKind.ElementAccessExpression) {
          const line = parent.getStartLineNumber()
          violations.push(
            createViolation(RULE_NAME, SEVERITY, line, `Direct process.env access via bracket notation. Use validated helper instead.`, {
              suggestion: "Use getRequiredEnv('VAR_NAME') from '#util/env-validation'",
              codeSnippet: parent.getText().substring(0, 60)
            })
          )
        }
      }
    }

    // Also check element access expressions for process.env['X']
    const elementAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)
    for (const access of elementAccesses) {
      const expression = access.getExpression()

      if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression)
        if (propAccess && propAccess.getExpression().getText() === 'process' && propAccess.getName() === 'env') {
          const line = access.getStartLineNumber()
          const argText = access.getArgumentExpression()?.getText() || 'unknown'

          violations.push(
            createViolation(RULE_NAME, SEVERITY, line, `Direct process.env bracket access: ${argText}. Use validated helper instead.`, {
              suggestion: `Use getRequiredEnv(${argText}) from '#util/env-validation'`,
              codeSnippet: access.getText().substring(0, 60)
            })
          )
        }
      }
    }

    return violations
  }
}
