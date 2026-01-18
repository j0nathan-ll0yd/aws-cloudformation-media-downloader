/**
 * Service Permissions Rule
 * HIGH: Lambda handlers that use AWS services must have `@RequiresServices` decorator
 *
 * This rule ensures that AWS service access requirements are explicitly declared.
 */

import type {SourceFile} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'service-permissions'
const SEVERITY = 'HIGH' as const

/**
 * AWS vendor wrapper import patterns and their service mappings
 */
const SERVICE_IMPORT_MAP: Record<string, string> = {
  '#lib/vendor/AWS/S3': 'S3',
  '#lib/vendor/AWS/SQS': 'SQS',
  '#lib/vendor/AWS/SNS': 'SNS',
  '#lib/vendor/AWS/EventBridge': 'EventBridge'
}

/**
 * Check if source file imports AWS service vendor wrappers
 */
function importsServiceWrappers(sourceFile: SourceFile): {importing: boolean; services: string[]} {
  const imports = sourceFile.getImportDeclarations()
  const services: string[] = []

  for (const importDecl of imports) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue()
    for (const [pattern, serviceName] of Object.entries(SERVICE_IMPORT_MAP)) {
      if (moduleSpecifier === pattern || moduleSpecifier.startsWith(pattern + '/')) {
        services.push(serviceName)
        break
      }
    }
  }

  // Deduplicate
  return {importing: services.length > 0, services: [...new Set(services)]}
}

/**
 * Check if a class has the `@RequiresServices` decorator
 */
function hasRequiresServicesDecorator(sourceFile: SourceFile): boolean {
  const classes = sourceFile.getClasses()
  for (const classDecl of classes) {
    const decorator = classDecl.getDecorator('RequiresServices')
    if (decorator) {
      return true
    }
  }
  return false
}

export const servicePermissionsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Lambda handlers that access AWS services must have @RequiresServices decorator.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/*/src/index.ts'],
  excludes: [],

  validate(sourceFile: SourceFile, _filePath: string): Violation[] {
    void _filePath
    const violations: Violation[] = []

    // Check for AWS service imports
    const {importing, services} = importsServiceWrappers(sourceFile)

    // If no service imports detected, no validation needed
    if (!importing) {
      return violations
    }

    // Check if @RequiresServices decorator exists
    if (!hasRequiresServicesDecorator(sourceFile)) {
      // Find the first service import line for better error location
      const imports = sourceFile.getImportDeclarations()
      const serviceImport = imports.find((i) =>
        Object.keys(SERVICE_IMPORT_MAP).some((p) => i.getModuleSpecifierValue() === p || i.getModuleSpecifierValue().startsWith(p + '/'))
      )
      const line = serviceImport ? serviceImport.getStartLineNumber() : 1

      violations.push(
        createViolation(RULE_NAME, SEVERITY, line, 'Lambda handler accesses AWS services but is missing @RequiresServices decorator', {
          suggestion: 'Add @RequiresServices decorator to the handler class with appropriate service permissions',
          codeSnippet: `Services used: ${services.join(', ')}`
        })
      )
    }

    return violations
  }
}
