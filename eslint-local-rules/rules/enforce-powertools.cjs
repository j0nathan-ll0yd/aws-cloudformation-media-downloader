/**
 * ESLint rule: enforce-powertools
 *
 * Ensures all Lambda handlers are wrapped with PowerTools decorators.
 *
 * Valid patterns:
 * - export const handler = withPowertools(...)
 * - export const handler = wrapLambdaInvokeHandler(...)
 * - export const handler = handlerInstance.handler.bind(handlerInstance) (class-based)
 *
 * Invalid patterns:
 * - export const handler = async (event, context) => {...}
 * - export function handler(event, context) {...}
 *
 * Excluded:
 * - CloudfrontMiddleware (Lambda@Edge has bundle size constraints that prevent PowerTools usage)
 */

// Lambda@Edge functions that can't use PowerTools due to bundle size constraints
const EXCLUDED_LAMBDAS = ['CloudfrontMiddleware']

// Allowed function wrapper names (functional composition pattern)
const ALLOWED_WRAPPERS = ['withPowertools', 'wrapLambdaInvokeHandler']

/**
 * Check if the call expression is a valid class-based handler pattern.
 * Pattern: handlerInstance.handler.bind(handlerInstance)
 */
function isClassBasedHandlerBind(init) {
  // Must be a CallExpression
  if (init.type !== 'CallExpression') return false

  // Callee must be a MemberExpression (something.bind)
  const callee = init.callee
  if (callee.type !== 'MemberExpression') return false

  // Property must be 'bind'
  if (callee.property.name !== 'bind') return false

  // The object being bound should be a MemberExpression (instance.handler)
  const object = callee.object
  if (object.type !== 'MemberExpression') return false

  // The property being bound should be 'handler'
  if (object.property.name !== 'handler') return false

  return true
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce PowerTools wrapper usage for Lambda handlers',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      missingPowertools: 'Lambda handler "{{name}}" must be wrapped with withPowertools(), wrapLambdaInvokeHandler(), or use class-based handler pattern'
    },
    schema: []
  },
  create(context) {
    // Only check files in src/lambdas/*/src/index.ts
    const filename = context.getFilename()
    if (!filename.includes('/src/lambdas/') || !filename.endsWith('/src/index.ts')) {
      return {}
    }

    // Skip Lambda@Edge functions
    if (EXCLUDED_LAMBDAS.some((lambda) => filename.includes(`/lambdas/${lambda}/`))) {
      return {}
    }

    return {
      ExportNamedDeclaration(node) {
        // Check if this is exporting 'handler'
        if (node.declaration?.type === 'VariableDeclaration') {
          const declaration = node.declaration.declarations[0]

          if (declaration?.id?.name === 'handler') {
            const init = declaration.init

            // Must have an initializer
            if (!init) {
              context.report({
                node,
                messageId: 'missingPowertools',
                data: {name: 'handler'}
              })
              return
            }

            // Check for class-based handler pattern: instance.handler.bind(instance)
            if (isClassBasedHandlerBind(init)) {
              return // Valid class-based handler
            }

            // Check for functional wrapper pattern: withPowertools(...) or wrapLambdaInvokeHandler(...)
            if (init.type === 'CallExpression' && ALLOWED_WRAPPERS.includes(init.callee.name)) {
              return // Valid functional wrapper
            }

            // Neither valid pattern found
            context.report({
              node,
              messageId: 'missingPowertools',
              data: {name: 'handler'}
            })
          }
        }

        // Also check function exports
        if (node.declaration?.type === 'FunctionDeclaration') {
          if (node.declaration.id?.name === 'handler') {
            context.report({
              node,
              messageId: 'missingPowertools',
              data: {name: 'handler'}
            })
          }
        }
      }
    }
  }
}
