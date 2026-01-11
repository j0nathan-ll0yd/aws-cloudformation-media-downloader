/**
 * AWS SDK Encapsulation Rule
 * CRITICAL: Never import AWS SDK directly - use lib/vendor/AWS/ wrappers
 *
 * This is a zero-tolerance rule per project conventions.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'aws-sdk-encapsulation'
const SEVERITY = 'CRITICAL' as const

/**
 * Vendor packages that should never be imported directly
 */
const FORBIDDEN_PACKAGES = [
  // AWS SDK v3
  '@aws-sdk/client-',
  '@aws-sdk/lib-',
  '@aws-sdk/util-',
  '@aws-sdk/credential-',
  '@aws-sdk/middleware-',
  'aws-sdk', // v2
  // AWS Lambda Powertools
  '@aws-lambda-powertools/',
  // OpenTelemetry
  '@opentelemetry/'
]

/**
 * Suggested vendor wrapper mappings
 */
const VENDOR_SUGGESTIONS: Record<string, string> = {
  // AWS SDK
  '@aws-sdk/client-dynamodb': 'lib/vendor/AWS/DynamoDB',
  '@aws-sdk/lib-dynamodb': 'lib/vendor/AWS/DynamoDB',
  '@aws-sdk/client-s3': 'lib/vendor/AWS/S3',
  '@aws-sdk/client-lambda': 'lib/vendor/AWS/Lambda',
  '@aws-sdk/client-sns': 'lib/vendor/AWS/SNS',
  '@aws-sdk/client-sqs': 'lib/vendor/AWS/SQS',
  '@aws-sdk/client-cloudwatch-logs': 'lib/vendor/AWS/CloudWatch',
  // AWS Lambda Powertools
  '@aws-lambda-powertools/logger': 'lib/vendor/Powertools',
  '@aws-lambda-powertools/metrics': 'lib/vendor/Powertools',
  '@aws-lambda-powertools/idempotency': 'lib/vendor/Powertools/idempotency',
  '@aws-lambda-powertools/parser': 'lib/vendor/Powertools/parser',
  // OpenTelemetry
  '@opentelemetry/api': 'lib/vendor/OpenTelemetry',
  '@opentelemetry/sdk-trace-node': 'lib/vendor/OpenTelemetry/sdk'
}

function getSuggestion(moduleSpecifier: string): string {
  for (const [pattern, vendor] of Object.entries(VENDOR_SUGGESTIONS)) {
    if (moduleSpecifier.startsWith(pattern) || moduleSpecifier === pattern) {
      return `Import from '${vendor}' instead`
    }
  }
  return 'Create a vendor wrapper in lib/vendor/AWS/ for this service'
}

export const awsSdkEncapsulationRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Never import AWS SDK packages directly. Use lib/vendor/AWS/ wrappers for encapsulation, type safety, and testability.',
  severity: SEVERITY,
  appliesTo: ['src/**/*.ts'],
  excludes: ['src/lib/vendor/AWS/**/*.ts', 'src/lib/vendor/Powertools/**/*.ts', 'src/lib/vendor/OpenTelemetry/**/*.ts', 'src/**/*.test.ts', 'test/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Skip vendor directories - that's where direct imports are allowed
    if (filePath.includes('lib/vendor/AWS') || filePath.includes('lib/vendor/Powertools') || filePath.includes('lib/vendor/OpenTelemetry')) {
      return violations
    }

    // Check all import declarations
    const imports = sourceFile.getImportDeclarations()

    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue()

      // Check if this is a forbidden AWS SDK import
      const isForbidden = FORBIDDEN_PACKAGES.some((pkg) => moduleSpecifier.startsWith(pkg))

      if (isForbidden) {
        const line = importDecl.getStartLineNumber()
        const importText = importDecl.getText()

        violations.push(
          createViolation(RULE_NAME, SEVERITY, line, `Direct AWS SDK import forbidden: '${moduleSpecifier}'`, {
            suggestion: getSuggestion(moduleSpecifier),
            codeSnippet: importText.substring(0, 100)
          })
        )
      }
    }

    // Also check dynamic imports
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    for (const call of callExpressions) {
      const expression = call.getExpression()
      if (expression.getText() === 'import') {
        const args = call.getArguments()
        if (args.length > 0) {
          const arg = args[0].getText().replace(/['"]/g, '')
          const isForbidden = FORBIDDEN_PACKAGES.some((pkg) => arg.startsWith(pkg))
          if (isForbidden) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, call.getStartLineNumber(), `Dynamic AWS SDK import forbidden: '${arg}'`, {suggestion: getSuggestion(arg)})
            )
          }
        }
      }
    }

    return violations
  }
}
