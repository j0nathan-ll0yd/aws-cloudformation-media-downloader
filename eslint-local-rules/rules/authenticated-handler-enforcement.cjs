/**
 * authenticated-handler-enforcement
 * HIGH: Detects manual getUserDetailsFromEvent + UserStatus checks in Lambda handlers
 * Suggests using wrapAuthenticatedHandler or wrapOptionalAuthHandler instead
 *
 * Mirrors: src/mcp/validation/rules/authenticated-handler-enforcement.ts
 */

function getSuggestion(hasAnonymousCheck, hasUnauthenticatedCheck) {
  if (hasAnonymousCheck && hasUnauthenticatedCheck) {
    return "Use 'wrapAuthenticatedHandler' - it rejects both Unauthenticated and Anonymous users automatically."
  } else if (hasUnauthenticatedCheck && !hasAnonymousCheck) {
    return "Use 'wrapOptionalAuthHandler' - it rejects Unauthenticated users but allows Anonymous."
  } else if (hasAnonymousCheck) {
    return "Use 'wrapAuthenticatedHandler' if you need both checks, or 'wrapOptionalAuthHandler' if Anonymous should be allowed."
  }
  return "Use 'wrapAuthenticatedHandler' for authenticated-only endpoints or 'wrapOptionalAuthHandler' for endpoints that allow anonymous access."
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce use of wrapAuthenticatedHandler/wrapOptionalAuthHandler instead of manual getUserDetailsFromEvent + UserStatus checks',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      manualAuth: "Manual auth handling detected: '{{function}}'. {{suggestion}}",
      redundantCall: 'Redundant getUserDetailsFromEvent call - wrapper already handles auth. Use userId/userStatus from wrapper params.'
    },
    schema: []
  },
  create(context) {
    const filename = context.filename || context.getFilename()

    // Only apply to Lambda handler files
    if (!filename.includes('/lambdas/') || !filename.includes('/src/index.ts')) {
      return {}
    }

    // Skip test files
    if (filename.includes('.test.') || filename.includes('/test/')) {
      return {}
    }

    let usesNewWrapper = false
    let hasAnonymousCheck = false
    let hasUnauthenticatedCheck = false

    return {
      // Track if new wrappers are used
      ImportDeclaration(node) {
        const source = node.source.value
        if (source.includes('lambda-helpers')) {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportSpecifier') {
              const name = specifier.imported.name
              if (name === 'wrapAuthenticatedHandler' || name === 'wrapOptionalAuthHandler') {
                usesNewWrapper = true
              }
            }
          }
        }
      },

      // Track UserStatus checks in the file
      BinaryExpression(node) {
        const code = context.sourceCode.getText(node)
        if (code.includes('UserStatus.Anonymous')) {
          hasAnonymousCheck = true
        }
        if (code.includes('UserStatus.Unauthenticated') || code.includes('!userId') || code.includes('userId ===')) {
          hasUnauthenticatedCheck = true
        }
      },

      // Detect getUserDetailsFromEvent calls
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'getUserDetailsFromEvent') {
          if (usesNewWrapper) {
            // Redundant call - wrapper already handles this
            context.report({
              node,
              messageId: 'redundantCall'
            })
          } else {
            // Manual auth handling - suggest using new wrapper
            context.report({
              node,
              messageId: 'manualAuth',
              data: {
                function: 'getUserDetailsFromEvent',
                suggestion: getSuggestion(hasAnonymousCheck, hasUnauthenticatedCheck)
              }
            })
          }
        }
      }
    }
  }
}
