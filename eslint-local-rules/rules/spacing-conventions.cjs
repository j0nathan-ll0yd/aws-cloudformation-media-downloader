/**
 * spacing-conventions
 * LOW: Enforce logical spacing patterns in functions
 *
 * This rule enforces the conventions documented in docs/wiki/Conventions/Function-Spacing.md:
 * - Simple functions (<=3 statements) should not have internal blank lines
 * - Log statements should be adjacent to their related operations
 * - Guard clauses should not have blank lines after them in simple cases
 *
 * Note: This is a "suggestion" level rule to help maintain consistent spacing
 * without blocking builds.
 */

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce logical spacing patterns in functions per Function-Spacing.md conventions',
      category: 'Stylistic Issues',
      recommended: false
    },
    messages: {
      unnecessaryBlankInSimple: 'Unnecessary blank line in simple function ({{count}} statements). Blank lines should separate logical concerns, not individual statements.',
      logOperationSeparation: 'Log statement should be adjacent to its related operation. Remove blank line between log and operation.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxSimpleStatements: {
            type: 'integer',
            minimum: 1,
            default: 3
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const filename = context.filename || context.getFilename()

    // Skip test files - they often have intentional spacing for readability
    if (filename.includes('.test.') || filename.includes('/test/')) {
      return {}
    }

    const options = context.options[0] || {}
    const maxSimpleStatements = options.maxSimpleStatements || 3
    const sourceCode = context.sourceCode || context.getSourceCode()

    /**
     * Count significant statements in a function body
     * Excludes variable declarations from count for simplicity
     */
    function countStatements(body) {
      if (!body || !body.body) return 0
      return body.body.length
    }

    /**
     * Check if a token is a blank line (empty line between statements)
     */
    function hasBlankLineBetween(node1, node2) {
      if (!node1 || !node2) return false

      const endLine = node1.loc.end.line
      const startLine = node2.loc.start.line

      // More than one line difference means there's a blank line
      return startLine - endLine > 1
    }

    /**
     * Check if a statement is a log call (logDebug, logInfo, logError, console.log)
     */
    function isLogStatement(node) {
      if (node.type !== 'ExpressionStatement') return false
      const expr = node.expression
      if (expr.type !== 'CallExpression') return false

      const callee = expr.callee
      if (callee.type === 'Identifier') {
        return ['logDebug', 'logInfo', 'logError', 'logWarn'].includes(callee.name)
      }
      if (callee.type === 'MemberExpression') {
        return callee.object.name === 'console'
      }
      return false
    }

    /**
     * Check function body for spacing violations
     */
    function checkFunctionBody(node) {
      const body = node.body
      if (!body || !body.body || body.body.length === 0) return

      const statements = body.body
      const statementCount = countStatements(body)

      // Check 1: Simple functions should not have internal blank lines
      if (statementCount <= maxSimpleStatements) {
        for (let i = 0; i < statements.length - 1; i++) {
          if (hasBlankLineBetween(statements[i], statements[i + 1])) {
            context.report({
              node: statements[i + 1],
              messageId: 'unnecessaryBlankInSimple',
              data: {count: statementCount}
            })
          }
        }
      }

      // Check 2: Log statements should be adjacent to operations
      // Pattern: logDebug('operation <=', params) followed by blank line before const result = operation()
      for (let i = 0; i < statements.length - 1; i++) {
        const current = statements[i]
        const next = statements[i + 1]

        // Check if current is a log and next is a variable declaration or expression
        if (isLogStatement(current) && hasBlankLineBetween(current, next)) {
          // Check if the log contains '<=' (input log pattern)
          const currentText = sourceCode.getText(current)
          if (currentText.includes("'<=") || currentText.includes('"<=')) {
            context.report({
              node: next,
              messageId: 'logOperationSeparation'
            })
          }
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        checkFunctionBody(node)
      },
      FunctionExpression(node) {
        checkFunctionBody(node)
      },
      ArrowFunctionExpression(node) {
        // Only check arrow functions with block bodies
        if (node.body.type === 'BlockStatement') {
          checkFunctionBody({body: node.body})
        }
      }
    }
  }
}
