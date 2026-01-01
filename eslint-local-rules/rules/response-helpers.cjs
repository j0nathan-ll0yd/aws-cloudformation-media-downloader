/**
 * response-helpers
 * HIGH: Lambda handlers must use buildValidatedResponse() helper, not raw objects
 *
 * Mirrors: src/mcp/validation/rules/response-helpers.ts
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Lambda handlers must use buildValidatedResponse() helper instead of raw response objects',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      rawResponse: 'Raw response object detected. Use buildValidatedResponse() from lambda/responses instead.',
      missingImport: 'Lambda handler returns API Gateway responses but does not import response helpers from lambda/responses.'
    },
    schema: []
  },
  create(context) {
    const filename = context.filename || context.getFilename()

    // Only check Lambda handler files
    if (!filename.includes('/lambdas/') || !filename.includes('/src/')) {
      return {}
    }

    // Skip test files
    if (filename.includes('.test.') || filename.includes('/test/')) {
      return {}
    }

    let hasResponseImport = false
    let hasStatusCodeReturn = false

    return {
      ImportDeclaration(node) {
        const moduleSpec = node.source.value
        if (moduleSpec.includes('lambda/responses')) {
          const specifiers = node.specifiers || []
          for (const spec of specifiers) {
            if (spec.type === 'ImportSpecifier') {
              const name = spec.imported?.name || spec.local?.name
              if (name === 'buildValidatedResponse' || name === 'buildErrorResponse') {
                hasResponseImport = true
              }
            }
          }
        }
      },

      ReturnStatement(node) {
        if (!node.argument) {
          return
        }

        // Check for object literal with statusCode property
        if (node.argument.type === 'ObjectExpression') {
          const properties = node.argument.properties || []
          const propertyNames = properties
            .filter((p) => p.type === 'Property')
            .map((p) => p.key?.name || p.key?.value)

          const hasStatusCode = propertyNames.includes('statusCode')
          const hasBody = propertyNames.includes('body')
          const hasHeaders = propertyNames.includes('headers')

          if (hasStatusCode && (hasBody || hasHeaders)) {
            hasStatusCodeReturn = true
            context.report({
              node,
              messageId: 'rawResponse'
            })
          }
        }
      },

      'Program:exit'() {
        // If file has statusCode returns but no response import, warn
        if (hasStatusCodeReturn && !hasResponseImport) {
          // This is already caught by the individual return statements
        }
      }
    }
  }
}
