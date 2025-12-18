/**
 * cascade-delete-order
 * WARN: Detect Promise.all with delete operations
 *
 * Mirrors: src/mcp/validation/rules/cascade-safety.ts
 */

const DELETE_PATTERNS = ['.delete(', '.remove(', 'batchWrite']

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Warn about unsafe cascade deletion patterns using Promise.all',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      promiseAll: 'Promise.all with delete operations detected. Use Promise.allSettled for cascade deletions to handle partial failures gracefully.'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        // Check for Promise.all
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'Promise' &&
          node.callee.property.name === 'all' &&
          node.arguments.length > 0
        ) {
          const sourceCode = context.sourceCode || context.getSourceCode()
          const argText = sourceCode.getText(node.arguments[0])

          const hasDeleteOps = DELETE_PATTERNS.some((pattern) => argText.includes(pattern))

          if (hasDeleteOps) {
            context.report({
              node,
              messageId: 'promiseAll'
            })
          }
        }
      }
    }
  }
}
