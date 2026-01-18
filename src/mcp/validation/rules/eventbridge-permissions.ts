/**
 * EventBridge Permissions Rule
 * HIGH: Lambda handlers that publish events must have `@RequiresEventBridge` decorator
 *
 * This rule ensures that event publishing/subscribing is explicitly declared.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'eventbridge-permissions'
const SEVERITY = 'HIGH' as const

/**
 * EventBridge-related function names
 */
const EVENTBRIDGE_FUNCTIONS = [
  'publishEvent',
  'publishEventWithRetry',
  'putEvents'
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
 * Check if source file calls event publishing functions and extract event types
 */
function getPublishedEvents(sourceFile: SourceFile): string[] {
  const events: string[] = []

  // Find all call expressions
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  for (const call of callExpressions) {
    const expression = call.getExpression()
    const funcName = expression.getText()

    // Check if this is a publishEvent or publishEventWithRetry call
    if (EVENTBRIDGE_FUNCTIONS.some((f) => funcName.includes(f))) {
      const args = call.getArguments()
      if (args.length > 0) {
        // First argument is typically the event type
        const eventTypeArg = args[0].getText()
        // Extract string value if it's a string literal
        const match = eventTypeArg.match(/['"`]([^'"`]+)['"`]/)
        if (match) {
          events.push(match[1])
        }
      }
    }
  }

  return [...new Set(events)]
}

/**
 * Check if a class has the `@RequiresEventBridge` decorator
 */
function hasRequiresEventBridgeDecorator(sourceFile: SourceFile): boolean {
  const classes = sourceFile.getClasses()
  for (const classDecl of classes) {
    const decorator = classDecl.getDecorator('RequiresEventBridge')
    if (decorator) {
      return true
    }
  }
  return false
}

/**
 * Get declared published events from @RequiresEventBridge decorator
 */
function getDeclaredPublishedEvents(sourceFile: SourceFile): string[] {
  const events: string[] = []
  const classes = sourceFile.getClasses()

  for (const classDecl of classes) {
    const decorator = classDecl.getDecorator('RequiresEventBridge')
    if (!decorator) {
      continue
    }

    const args = decorator.getArguments()
    if (args.length === 0) {
      continue
    }

    const eventObj = args[0].asKind(SyntaxKind.ObjectLiteralExpression)
    if (!eventObj) {
      continue
    }

    for (const prop of eventObj.getProperties()) {
      if (prop.isKind(SyntaxKind.PropertyAssignment) && prop.getName() === 'publishes') {
        const arrayLiteral = prop.getInitializer()?.asKind(SyntaxKind.ArrayLiteralExpression)
        if (arrayLiteral) {
          for (const element of arrayLiteral.getElements()) {
            const match = element.getText().match(/['"`]([^'"`]+)['"`]/)
            if (match) {
              events.push(match[1])
            }
          }
        }
      }
    }
  }

  return events
}

export const eventBridgePermissionsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Lambda handlers that publish EventBridge events must have @RequiresEventBridge decorator.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/*/src/index.ts'],
  excludes: [],

  validate(sourceFile: SourceFile, _filePath: string): Violation[] {
    void _filePath
    const violations: Violation[] = []

    // Check for EventBridge imports
    const importing = importsEventBridge(sourceFile)

    // If no EventBridge imports, no validation needed
    if (!importing) {
      return violations
    }

    // Get published events from code
    const publishedEvents = getPublishedEvents(sourceFile)

    // If no events are published, skip (might just import utilities)
    if (publishedEvents.length === 0) {
      return violations
    }

    // Check if @RequiresEventBridge decorator exists
    if (!hasRequiresEventBridgeDecorator(sourceFile)) {
      // Find the EventBridge import line for better error location
      const imports = sourceFile.getImportDeclarations()
      const ebImport = imports.find((i) => i.getModuleSpecifierValue().includes('EventBridge'))
      const line = ebImport ? ebImport.getStartLineNumber() : 1

      violations.push(
        createViolation(RULE_NAME, SEVERITY, line, 'Lambda handler publishes events but is missing @RequiresEventBridge decorator', {
          suggestion: 'Add @RequiresEventBridge decorator to the handler class with published event types',
          codeSnippet: `Events published: ${publishedEvents.join(', ')}`
        })
      )
      return violations
    }

    // Check if all published events are declared
    const declaredEvents = getDeclaredPublishedEvents(sourceFile)
    const undeclaredEvents = publishedEvents.filter((e) => !declaredEvents.includes(e))

    if (undeclaredEvents.length > 0) {
      const classes = sourceFile.getClasses()
      const classWithDecorator = classes.find((c) => c.getDecorator('RequiresEventBridge'))
      const line = classWithDecorator ? classWithDecorator.getStartLineNumber() : 1

      violations.push(
        createViolation(RULE_NAME, SEVERITY, line, `@RequiresEventBridge decorator is missing published events: ${undeclaredEvents.join(', ')}`, {
          suggestion: 'Add the missing event types to the publishes array',
          codeSnippet: `Declared: [${declaredEvents.join(', ')}], Actual: [${publishedEvents.join(', ')}]`
        })
      )
    }

    return violations
  }
}
