/**
 * Authenticated Handler Enforcement Rule
 * HIGH: Detects manual getUserDetailsFromEvent() + UserStatus checks and suggests using
 * wrapAuthenticatedHandler or wrapOptionalAuthHandler instead
 *
 * This rule promotes centralized auth handling for consistency and type safety.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'authenticated-handler-enforcement'
const SEVERITY = 'HIGH' as const

/**
 * Patterns that indicate manual auth handling (anti-patterns)
 */
const AUTH_PATTERNS = {
  getUserDetailsFromEvent: 'getUserDetailsFromEvent',
  userStatusCheck: /userStatus\s*===?\s*UserStatus\.(Unauthenticated|Anonymous)/,
  userIdCheck: /!userId|userId\s*===?\s*(undefined|null)|typeof\s+userId\s*===?\s*'undefined'/
}

/**
 * Determine which wrapper to suggest based on context
 */
function getSuggestion(hasAnonymousCheck: boolean, hasUnauthenticatedCheck: boolean): string {
  if (hasAnonymousCheck && hasUnauthenticatedCheck) {
    return "Use 'wrapAuthenticatedHandler' - it rejects both Unauthenticated and Anonymous users automatically"
  } else if (hasUnauthenticatedCheck && !hasAnonymousCheck) {
    return "Use 'wrapOptionalAuthHandler' - it rejects Unauthenticated users but allows Anonymous"
  } else if (hasAnonymousCheck) {
    return "Use 'wrapAuthenticatedHandler' if you need both checks, or 'wrapOptionalAuthHandler' if Anonymous should be allowed"
  }
  return "Use 'wrapAuthenticatedHandler' for authenticated-only endpoints or 'wrapOptionalAuthHandler' for endpoints that allow anonymous access"
}

export const authenticatedHandlerEnforcementRule: ValidationRule = {
  name: RULE_NAME,
  description:
    'Use wrapAuthenticatedHandler or wrapOptionalAuthHandler instead of manual getUserDetailsFromEvent + UserStatus checks for consistent, type-safe auth handling.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/**/src/index.ts'],
  excludes: ['src/**/*.test.ts', 'test/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Skip if file doesn't appear to be a Lambda handler
    if (!filePath.includes('/lambdas/') || !filePath.includes('/src/index.ts')) {
      return violations
    }

    const fileText = sourceFile.getFullText()

    // Check for getUserDetailsFromEvent import or call
    const hasGetUserDetails = fileText.includes(AUTH_PATTERNS.getUserDetailsFromEvent)

    if (!hasGetUserDetails) {
      return violations // No manual auth handling detected
    }

    // Find the location of getUserDetailsFromEvent
    let getUserDetailsLine = 1
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    for (const call of callExpressions) {
      const callText = call.getText()
      if (callText.includes(AUTH_PATTERNS.getUserDetailsFromEvent)) {
        getUserDetailsLine = call.getStartLineNumber()
        break
      }
    }

    // Check for UserStatus checks
    const hasAnonymousCheck = AUTH_PATTERNS.userStatusCheck.test(fileText) && fileText.includes('Anonymous')
    const hasUnauthenticatedCheck = AUTH_PATTERNS.userStatusCheck.test(fileText) &&
      (fileText.includes('Unauthenticated') || AUTH_PATTERNS.userIdCheck.test(fileText))

    // Check if already using the new wrappers
    const usesAuthenticatedWrapper = fileText.includes('wrapAuthenticatedHandler')
    const usesOptionalAuthWrapper = fileText.includes('wrapOptionalAuthHandler')

    if (usesAuthenticatedWrapper || usesOptionalAuthWrapper) {
      // Already using new wrappers - check if getUserDetailsFromEvent is still present (shouldn't be)
      if (hasGetUserDetails) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, getUserDetailsLine,
            'Redundant getUserDetailsFromEvent call - wrapAuthenticatedHandler/wrapOptionalAuthHandler already handles this', {
            suggestion: 'Remove getUserDetailsFromEvent call and use userId/userStatus from wrapper params'
          })
        )
      }
      return violations
    }

    // Using getUserDetailsFromEvent without new wrappers - this is the anti-pattern
    if (hasGetUserDetails) {
      const suggestion = getSuggestion(hasAnonymousCheck, hasUnauthenticatedCheck)

      violations.push(
        createViolation(RULE_NAME, SEVERITY, getUserDetailsLine, 'Manual auth handling detected - use centralized wrapper instead', {
          suggestion,
          codeSnippet: `const {userId, userStatus} = getUserDetailsFromEvent(event)`
        })
      )
    }

    return violations
  }
}
