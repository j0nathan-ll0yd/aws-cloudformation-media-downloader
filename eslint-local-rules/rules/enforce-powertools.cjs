/**
 * ESLint rule: enforce-powertools
 * 
 * Ensures all Lambda handlers are wrapped with PowerTools decorators.
 * 
 * Valid patterns:
 * - export const handler = withPowertools(...)
 * - export const handler = wrapLambdaInvokeHandler(...)
 * 
 * Invalid patterns:
 * - export const handler = async (event, context) => {...}
 * - export function handler(event, context) {...}
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce PowerTools wrapper usage for Lambda handlers',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      missingPowertools: 'Lambda handler "{{name}}" must be wrapped with withPowertools() or wrapLambdaInvokeHandler()'
    },
    schema: []
  },
  create(context) {
    // Only check files in src/lambdas/*/src/index.ts
    const filename = context.getFilename()
    if (!filename.includes('/src/lambdas/') || !filename.endsWith('/src/index.ts')) {
      return {}
    }

    return {
      ExportNamedDeclaration(node) {
        // Check if this is exporting 'handler'
        if (node.declaration?.type === 'VariableDeclaration') {
          const declaration = node.declaration.declarations[0]
          
          if (declaration?.id?.name === 'handler') {
            // Check if the init value is a call expression to withPowertools or wrapLambdaInvokeHandler
            const init = declaration.init
            
            if (!init || init.type !== 'CallExpression') {
              context.report({
                node,
                messageId: 'missingPowertools',
                data: {name: 'handler'}
              })
              return
            }

            const calleeName = init.callee.name
            if (calleeName !== 'withPowertools' && calleeName !== 'wrapLambdaInvokeHandler') {
              context.report({
                node,
                messageId: 'missingPowertools',
                data: {name: 'handler'}
              })
            }
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
