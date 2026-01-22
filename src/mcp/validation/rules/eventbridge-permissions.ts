/**
 * EventBridge Permissions Rule
 * LOW: Validates Lambda handlers use event-specific publisher functions
 *
 * Event types are now inferred from function names:
 * - publishEventDownloadRequested() → publishes DownloadRequested
 * - publishEventDownloadCompleted() → publishes DownloadCompleted
 * - publishEventDownloadFailed() → publishes DownloadFailed
 *
 * This rule ensures the new pattern is followed and warns about deprecated
 * generic publishEvent() calls.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'eventbridge-permissions'
const SEVERITY = 'LOW' as const

/**
 * Event-specific publisher functions (preferred pattern)
 */
const EVENT_SPECIFIC_FUNCTIONS = [
  'publishEventDownloadRequested',
  'publishEventDownloadRequestedWithRetry',
  'publishEventDownloadCompleted',
  'publishEventDownloadFailed',
]

/**
 * Generic publisher functions (deprecated pattern)
 */
const GENERIC_FUNCTIONS = [
  'publishEvent',
  'publishEventWithRetry',
]

/**
 * Check if source file imports EventBridge vendor wrapper
 */
function importsEventBridge(sourceFile: SourceFile): boolean {
  const imports = sourceFile.getImportDeclarations()
  for (const importDecl of imports) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue()
    if (moduleSpecifier === '#lib/vendor/AWS/EventBridge' || moduleSpecifier.startsWith('#lib/vendor/AWS/EventBridge/')) {
      return true
    }
  }
  return false
}

/**
 * Get all EventBridge function calls in the source file
 */
function getEventBridgeCalls(sourceFile: SourceFile): {eventSpecific: string[]; generic: string[]} {
  const eventSpecific: string[] = []
  const generic: string[] = []

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  for (const call of callExpressions) {
    const expression = call.getExpression()
    const funcName = expression.getText()

    // Check for event-specific functions
    for (const specificFunc of EVENT_SPECIFIC_FUNCTIONS) {
      if (funcName.includes(specificFunc)) {
        eventSpecific.push(specificFunc)
        break
      }
    }

    // Check for generic functions (but not if they match an event-specific pattern)
    for (const genericFunc of GENERIC_FUNCTIONS) {
      if (funcName.includes(genericFunc) && !EVENT_SPECIFIC_FUNCTIONS.some(s => funcName.includes(s))) {
        generic.push(genericFunc)
        break
      }
    }
  }

  return {eventSpecific: [...new Set(eventSpecific)], generic: [...new Set(generic)]}
}

export const eventBridgePermissionsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Lambda handlers should use event-specific publisher functions (publishEventDownloadRequested, etc.).',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/*/src/index.ts'],
  excludes: [],

  validate(sourceFile: SourceFile, _filePath: string): Violation[] {
    void _filePath
    const violations: Violation[] = []

    // Check for EventBridge imports
    if (!importsEventBridge(sourceFile)) {
      return violations
    }

    const {eventSpecific, generic} = getEventBridgeCalls(sourceFile)

    // Warn about generic function usage (deprecated pattern)
    if (generic.length > 0) {
      const imports = sourceFile.getImportDeclarations()
      const ebImport = imports.find((i) => i.getModuleSpecifierValue().includes('EventBridge'))
      const line = ebImport ? ebImport.getStartLineNumber() : 1

      violations.push(
        createViolation(
          RULE_NAME,
          SEVERITY,
          line,
          `Lambda handler uses generic EventBridge functions: ${generic.join(', ')}`,
          {
            suggestion: 'Use event-specific functions instead: publishEventDownloadRequested(), publishEventDownloadCompleted(), publishEventDownloadFailed()',
            codeSnippet: `Replace with event-specific function for type safety and static analysis`
          }
        )
      )
    }

    // Info: Log event-specific functions found (for documentation purposes)
    // This is informational only - no violation for using the correct pattern
    if (eventSpecific.length > 0) {
      // Events are now self-documenting via function names
      // No violation needed - this is the desired pattern
    }

    return violations
  }
}
