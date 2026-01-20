/**
 * Vendor Decorator Coverage Rule
 * HIGH: All public static methods in vendor wrapper classes must have @RequiresXxx decorators
 *
 * This rule ensures that AWS service permissions are explicitly declared on all vendor wrapper methods.
 * Permission decorators are extracted at build time to generate Lambda IAM policies automatically.
 */

import type {SourceFile} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'vendor-decorator-coverage'
const SEVERITY = 'HIGH' as const

/**
 * Valid decorator names for vendor wrapper methods.
 * Each decorator declares permissions for a specific AWS service.
 */
const VALID_DECORATORS = [
  'RequiresSNS',
  'RequiresS3',
  'RequiresSQS',
  'RequiresEventBridge',
  'RequiresApiGateway',
  'RequiresLambda'
]

/**
 * Check if a method has any valid permission decorator
 */
function hasPermissionDecorator(decorators: {getName(): string}[]): boolean {
  return decorators.some((d) => VALID_DECORATORS.includes(d.getName()))
}

/**
 * Get all static methods from vendor classes that are missing decorators
 */
function getMissingDecoratorMethods(sourceFile: SourceFile): {className: string; methodName: string; line: number}[] {
  const methods: {className: string; methodName: string; line: number}[] = []
  const classes = sourceFile.getClasses()

  for (const classDecl of classes) {
    const className = classDecl.getName() || ''
    // Only process classes that end with 'Vendor'
    if (!className.endsWith('Vendor')) {
      continue
    }

    for (const method of classDecl.getStaticMethods()) {
      const decorators = method.getDecorators()
      if (!hasPermissionDecorator(decorators)) {
        methods.push({className, methodName: method.getName(), line: method.getStartLineNumber()})
      }
    }
  }

  return methods
}

export const vendorDecoratorCoverageRule: ValidationRule = {
  name: RULE_NAME,
  description: 'All public static methods in vendor wrapper classes must have @RequiresXxx permission decorators.',
  severity: SEVERITY,
  appliesTo: ['src/lib/vendor/AWS/*.ts'],
  excludes: [
    'src/lib/vendor/AWS/decorators.ts',
    'src/lib/vendor/AWS/index.ts',
    'src/lib/vendor/AWS/clients.ts'
  ],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    void filePath
    const violations: Violation[] = []

    const missingDecoratorMethods = getMissingDecoratorMethods(sourceFile)

    for (const {className, methodName, line} of missingDecoratorMethods) {
      violations.push(
        createViolation(RULE_NAME, SEVERITY, line, `Vendor method ${className}.${methodName} is missing a @RequiresXxx permission decorator`, {
          suggestion: `Add appropriate permission decorator (e.g., @RequiresS3, @RequiresSNS, @RequiresApiGateway, @RequiresLambda)`,
          codeSnippet: `${className}.${methodName}()`
        })
      )
    }

    return violations
  }
}
