/**
 * Secret Permissions Rule
 * HIGH: Lambda handlers that import secret utilities must have `@RequiresSecrets` decorator
 *
 * This rule ensures that secret access requirements are explicitly declared.
 */

import type {SourceFile} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'secret-permissions'
const SEVERITY = 'HIGH' as const

/**
 * Patterns that indicate secret access
 */
const SECRET_IMPORT_PATTERNS = [
  '#lib/vendor/AWS/SecretsManager',
  '#lib/vendor/AWS/SSM',
  '@aws-sdk/client-secrets-manager',
  '@aws-sdk/client-ssm'
]

/**
 * Function names that indicate secret access
 */
const SECRET_FUNCTION_NAMES = [
  'getSecret',
  'getSecretValue',
  'getParameter',
  'getParameters'
]

/**
 * Check if source file imports secret-related modules
 */
function importsSecretUtilities(sourceFile: SourceFile): {importing: boolean; modules: string[]} {
  const imports = sourceFile.getImportDeclarations()
  const modules: string[] = []

  for (const importDecl of imports) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue()
    for (const pattern of SECRET_IMPORT_PATTERNS) {
      if (moduleSpecifier.includes(pattern)) {
        modules.push(moduleSpecifier)
        break
      }
    }
  }

  return {importing: modules.length > 0, modules}
}

/**
 * Check if source file calls secret-related functions
 */
function callsSecretFunctions(sourceFile: SourceFile): {calling: boolean; functions: string[]} {
  const functions: string[] = []
  const text = sourceFile.getFullText()

  for (const funcName of SECRET_FUNCTION_NAMES) {
    // Simple regex to find function calls
    const pattern = new RegExp(`\\b${funcName}\\s*\\(`, 'g')
    if (pattern.test(text)) {
      functions.push(funcName)
    }
  }

  return {calling: functions.length > 0, functions}
}

/**
 * Check if a class has the `@RequiresSecrets` decorator
 */
function hasRequiresSecretsDecorator(sourceFile: SourceFile): boolean {
  const classes = sourceFile.getClasses()
  for (const classDecl of classes) {
    const decorator = classDecl.getDecorator('RequiresSecrets')
    if (decorator) {
      return true
    }
  }
  return false
}

export const secretPermissionsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Lambda handlers that access secrets must have @RequiresSecrets decorator.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/*/src/index.ts'],
  excludes: [],

  validate(sourceFile: SourceFile, _filePath: string): Violation[] {
    void _filePath
    const violations: Violation[] = []

    // Check for secret-related imports
    const {importing, modules} = importsSecretUtilities(sourceFile)

    // Check for secret-related function calls
    const {calling, functions} = callsSecretFunctions(sourceFile)

    // If no secret access detected, no validation needed
    if (!importing && !calling) {
      return violations
    }

    // Check if @RequiresSecrets decorator exists
    if (!hasRequiresSecretsDecorator(sourceFile)) {
      // Find the relevant import line for better error location
      const imports = sourceFile.getImportDeclarations()
      const secretImport = imports.find((i) => SECRET_IMPORT_PATTERNS.some((p) => i.getModuleSpecifierValue().includes(p)))
      const line = secretImport ? secretImport.getStartLineNumber() : 1

      const evidence: string[] = []
      if (modules.length > 0) {
        evidence.push(`imports: ${modules.join(', ')}`)
      }
      if (functions.length > 0) {
        evidence.push(`functions: ${functions.join(', ')}`)
      }

      violations.push(
        createViolation(RULE_NAME, SEVERITY, line, 'Lambda handler accesses secrets but is missing @RequiresSecrets decorator', {
          suggestion: 'Add @RequiresSecrets decorator to the handler class with appropriate secret permissions',
          codeSnippet: evidence.join('; ')
        })
      )
    }

    return violations
  }
}
