/**
 * Response Helpers Rule
 * HIGH: Lambda handlers must use response() helper, not raw objects
 *
 * Ensures consistent response formatting across all Lambda functions.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'response-helpers'
const SEVERITY = 'HIGH' as const

export const responseHelpersRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Lambda handlers must use buildApiResponse() helper from lambda-helpers.ts instead of raw response objects.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/**/src/*.ts'],
  excludes: ['**/*.test.ts', 'test/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Only check Lambda handler files
    if (!filePath.includes('/lambdas/') || !filePath.endsWith('/src/index.ts')) {
      return violations
    }

    // Check if response helper is imported
    const imports = sourceFile.getImportDeclarations()
    const hasResponseImport = imports.some((imp) => {
      const moduleSpec = imp.getModuleSpecifierValue()
      if (moduleSpec.includes('lambda-helpers')) {
        const namedImports = imp.getNamedImports().map((n) => n.getName())
        return namedImports.includes('response') || namedImports.includes('lambdaErrorResponse') || namedImports.includes('buildApiResponse')
      }
      return false
    })

    // Find return statements
    const returnStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement)

    for (const returnStmt of returnStatements) {
      const expression = returnStmt.getExpression()
      if (!expression) {
        continue
      }

      const returnText = expression.getText()

      // Check for raw response objects: { statusCode: ..., body: ... }
      if (expression.getKind() === SyntaxKind.ObjectLiteralExpression) {
        const objLiteral = expression.asKind(SyntaxKind.ObjectLiteralExpression)
        if (!objLiteral) {
          continue
        }

        const properties = objLiteral.getProperties()
        const propertyNames = properties.map((p) => {
          if (p.getKind() === SyntaxKind.PropertyAssignment) {
            return p.asKind(SyntaxKind.PropertyAssignment)?.getName()
          }
          if (p.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
            return p.asKind(SyntaxKind.ShorthandPropertyAssignment)?.getName()
          }
          return undefined
        }).filter(Boolean)

        // Detect raw response pattern
        const hasStatusCode = propertyNames.includes('statusCode')
        const hasBody = propertyNames.includes('body')
        const hasHeaders = propertyNames.includes('headers')

        if (hasStatusCode && (hasBody || hasHeaders)) {
          // This looks like a raw Lambda response object
          violations.push(
            createViolation(RULE_NAME, SEVERITY, returnStmt.getStartLineNumber(),
              'Raw response object detected. Use buildApiResponse() or lambdaErrorResponse() helper instead.', {
              suggestion: hasResponseImport
                ? 'Replace with: return buildApiResponse(context, statusCode, data) or return lambdaErrorResponse(context, error)'
                : "Import {buildApiResponse, lambdaErrorResponse} from '#util/lambda-helpers' and use those helpers",
              codeSnippet: returnText.substring(0, 100)
            })
          )
        }
      }

      // Check for Promise.resolve with raw objects
      if (returnText.includes('Promise.resolve') && returnText.includes('statusCode')) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, returnStmt.getStartLineNumber(),
            'Promise.resolve with raw response object. Use buildApiResponse() helper directly.', {
            suggestion: 'The buildApiResponse() helper already returns a proper object, no need for Promise.resolve'
          })
        )
      }
    }

    // If no response helper is imported but file has return statements with API responses
    if (!hasResponseImport) {
      // Check if this Lambda returns API Gateway responses
      const handlerFunction = sourceFile.getFunction('handler') || sourceFile.getVariableDeclaration('handler')

      if (handlerFunction) {
        const functionText = sourceFile.getFullText()
        if (functionText.includes('APIGateway') && functionText.includes('statusCode')) {
          violations.push(
            createViolation(RULE_NAME, SEVERITY, 1, 'Lambda handler does not import response helpers but appears to return API Gateway responses', {
              suggestion: "import {buildApiResponse, lambdaErrorResponse} from '#util/lambda-helpers'"
            })
          )
        }
      }
    }

    return violations
  }
}
