/**
 * env-validation
 * CRITICAL: Detect direct process.env access without validated helpers
 *
 * Mirrors: src/mcp/validation/rules/env-validation.ts
 */

const ALLOWED_HELPERS = ['getRequiredEnv', 'getRequiredEnvNumber', 'getOptionalEnv']

// AWS Lambda runtime-provided env vars (always set by AWS, don't need validation)
const AWS_RUNTIME_ENV_VARS = [
  'AWS_LAMBDA_FUNCTION_NAME',
  'AWS_LAMBDA_FUNCTION_VERSION',
  'AWS_LAMBDA_FUNCTION_MEMORY_SIZE',
  'AWS_LAMBDA_LOG_GROUP_NAME',
  'AWS_LAMBDA_LOG_STREAM_NAME',
  'AWS_REGION',
  'AWS_DEFAULT_REGION',
  'AWS_EXECUTION_ENV',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  '_X_AMZN_TRACE_ID'
]

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct process.env access - use getRequiredEnv() from env-validation.ts',
      category: 'Best Practices',
      recommended: true
    },
    messages: {
      directAccess: "Direct process.env.{{name}} access detected. Use getRequiredEnv('{{name}}') from '#util/env-validation' instead.",
      bracketAccess: "Direct process.env bracket access detected. Use getRequiredEnv() from '#util/env-validation' instead."
    },
    schema: []
  },
  create(context) {
    const filename = context.filename || context.getFilename()

    // Only check Lambda source files and utilities
    const isLambdaSource = filename.includes('/lambdas/') && filename.includes('/src/')
    const isUtility = filename.includes('/util/') && !filename.includes('env-validation')

    if (!isLambdaSource && !isUtility) {
      return {}
    }

    // Skip test files
    if (filename.includes('.test.') || filename.includes('/test/')) {
      return {}
    }

    // Skip the env-validation utility itself
    if (filename.includes('env-validation')) {
      return {}
    }

    /**
     * Check if node is inside a getRequiredEnv/getOptionalEnv call
     */
    function isInsideHelperCall(node) {
      let current = node.parent
      while (current) {
        if (current.type === 'CallExpression') {
          const callee = current.callee
          if (callee.type === 'Identifier' && ALLOWED_HELPERS.includes(callee.name)) {
            return true
          }
        }
        current = current.parent
      }
      return false
    }

    return {
      MemberExpression(node) {
        // Check for process.env.SOMETHING pattern
        if (
          node.object.type === 'MemberExpression' &&
          node.object.object.type === 'Identifier' &&
          node.object.object.name === 'process' &&
          node.object.property.type === 'Identifier' &&
          node.object.property.name === 'env'
        ) {
          // This is process.env.X
          const envVarName = node.property.name || node.property.value || 'UNKNOWN'

          // Allow AWS runtime-provided env vars (don't need validation)
          if (AWS_RUNTIME_ENV_VARS.includes(envVarName)) {
            return
          }

          if (!isInsideHelperCall(node)) {
            context.report({
              node,
              messageId: 'directAccess',
              data: {name: envVarName}
            })
          }
        }

        // Check for process.env['X'] pattern (computed property)
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'process' &&
          node.property.type === 'Identifier' &&
          node.property.name === 'env' &&
          node.parent?.type === 'MemberExpression' &&
          node.parent.computed === true
        ) {
          if (!isInsideHelperCall(node.parent)) {
            context.report({
              node: node.parent,
              messageId: 'bracketAccess'
            })
          }
        }
      }
    }
  }
}
