/**
 * ESLint rule: strict-env-vars
 * 
 * Forbids direct process.env access in Lambda handlers.
 * Enforces use of the #lib/system/env module for centralized env var management.
 * 
 * Valid patterns:
 * - import {getRequiredEnv} from '#util/env-validation'
 * - const config = getRequiredEnv('CONFIG')
 * 
 * Invalid patterns:
 * - const config = process.env.CONFIG
 * - process.env.CONFIG
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce centralized environment variable access',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      directEnvAccess: 'Direct process.env access is forbidden. Use getRequiredEnv() or getRequiredEnvNumber() from #util/env-validation'
    },
    schema: []
  },
  create(context) {
    // Only check Lambda handler files
    const filename = context.getFilename()
    if (!filename.includes('/src/lambdas/')) {
      return {}
    }

    // Allow test files to set process.env for test setup
    if (filename.includes('.test.') || filename.includes('.spec.') || filename.includes('/test/')) {
      return {}
    }

    return {
      MemberExpression(node) {
        // Check for process.env.SOMETHING access
        if (
          node.object.type === 'MemberExpression' &&
          node.object.object.name === 'process' &&
          node.object.property.name === 'env'
        ) {
          context.report({
            node,
            messageId: 'directEnvAccess'
          })
        }

        // Also catch direct process.env patterns
        if (node.object.name === 'process' && node.property.name === 'env') {
          context.report({
            node,
            messageId: 'directEnvAccess'
          })
        }
      }
    }
  }
}
