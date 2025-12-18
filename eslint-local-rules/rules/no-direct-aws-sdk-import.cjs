/**
 * no-direct-aws-sdk-import
 * CRITICAL: Blocks direct AWS SDK imports outside vendor directory
 *
 * Mirrors: src/mcp/validation/rules/aws-sdk-encapsulation.ts
 */

const FORBIDDEN_PACKAGES = [
  '@aws-sdk/client-',
  '@aws-sdk/lib-',
  '@aws-sdk/util-',
  '@aws-sdk/credential-',
  '@aws-sdk/middleware-',
  'aws-sdk'
]

const VENDOR_SUGGESTIONS = {
  '@aws-sdk/client-dynamodb': 'lib/vendor/AWS/DynamoDB',
  '@aws-sdk/lib-dynamodb': 'lib/vendor/AWS/DynamoDB',
  '@aws-sdk/client-s3': 'lib/vendor/AWS/S3',
  '@aws-sdk/client-lambda': 'lib/vendor/AWS/Lambda',
  '@aws-sdk/client-sns': 'lib/vendor/AWS/SNS',
  '@aws-sdk/client-sqs': 'lib/vendor/AWS/SQS',
  '@aws-sdk/client-cloudwatch-logs': 'lib/vendor/AWS/CloudWatch',
  '@aws-sdk/client-secrets-manager': 'lib/vendor/AWS/SecretsManager'
}

function getSuggestion(moduleSpecifier) {
  for (const [pattern, vendor] of Object.entries(VENDOR_SUGGESTIONS)) {
    if (moduleSpecifier.startsWith(pattern) || moduleSpecifier === pattern) {
      return `Import from '${vendor}' instead.`
    }
  }
  return 'Create a vendor wrapper in lib/vendor/AWS/ for this service.'
}

function isForbiddenImport(moduleSpecifier) {
  return FORBIDDEN_PACKAGES.some((pkg) => moduleSpecifier.startsWith(pkg))
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct AWS SDK imports outside vendor directory',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      forbidden: "Direct AWS SDK import forbidden: '{{module}}'. {{suggestion}}"
    },
    schema: []
  },
  create(context) {
    const filename = context.filename || context.getFilename()

    // Allow imports in vendor directories and integration test helpers
    // - lib/vendor/AWS/ - AWS SDK wrappers
    // - lib/vendor/ElectroDB/ - ElectroDB service (needs DynamoDB client)
    // - test/integration/helpers/ - LocalStack setup (needs direct client access)
    if (
      filename.includes('lib/vendor/AWS') ||
      filename.includes('lib/vendor/ElectroDB') ||
      filename.includes('test/integration/helpers')
    ) {
      return {}
    }

    return {
      ImportDeclaration(node) {
        const moduleSpecifier = node.source.value

        if (isForbiddenImport(moduleSpecifier)) {
          context.report({
            node,
            messageId: 'forbidden',
            data: {
              module: moduleSpecifier,
              suggestion: getSuggestion(moduleSpecifier)
            }
          })
        }
      },
      CallExpression(node) {
        // Check dynamic imports
        if (node.callee.type === 'Import' && node.arguments.length > 0) {
          const arg = node.arguments[0]
          if (arg.type === 'Literal' && typeof arg.value === 'string') {
            if (isForbiddenImport(arg.value)) {
              context.report({
                node,
                messageId: 'forbidden',
                data: {
                  module: arg.value,
                  suggestion: getSuggestion(arg.value)
                }
              })
            }
          }
        }
      }
    }
  }
}
