/**
 * Tests for env-validation ESLint rule
 */

const {RuleTester} = require('eslint')
const rule = require('../rules/env-validation.cjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
})

ruleTester.run('env-validation', rule, {
  valid: [
    // Allowed: Using getRequiredEnv helper
    {
      code: `
        import {getRequiredEnv} from '#util/env-validation'
        const tableName = getRequiredEnv('DYNAMODB_TABLE_NAME')
      `,
      filename: 'src/lambdas/ListFiles/src/index.ts'
    },
    // Allowed: Using getOptionalEnv helper
    {
      code: `
        import {getOptionalEnv} from '#util/env-validation'
        const debugMode = getOptionalEnv('DEBUG_MODE')
      `,
      filename: 'src/lambdas/ListFiles/src/index.ts'
    },
    // Allowed: Using getRequiredEnvNumber helper
    {
      code: `
        import {getRequiredEnvNumber} from '#util/env-validation'
        const timeout = getRequiredEnvNumber('TIMEOUT_MS')
      `,
      filename: 'src/lambdas/ListFiles/src/index.ts'
    },
    // Allowed: Test file can use process.env directly
    {
      code: `
        process.env.TEST_VAR = 'test'
        const val = process.env.TEST_VAR
      `,
      filename: 'src/lambdas/ListFiles/test/index.test.ts'
    },
    // Allowed: env-validation.ts itself can use process.env
    {
      code: `
        export function getRequiredEnv(name) {
          const value = process.env[name]
          if (!value) throw new Error('Missing ' + name)
          return value
        }
      `,
      filename: 'src/util/env-validation.ts'
    },
    // Allowed: Non-Lambda, non-utility file
    {
      code: `
        const region = process.env.AWS_REGION
      `,
      filename: 'src/entities/Users.ts'
    },
    // Allowed: AWS runtime env vars (always set by Lambda, don't need validation)
    {
      code: `
        const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown'
        const region = process.env.AWS_REGION
      `,
      filename: 'src/util/lambda-helpers.ts'
    }
  ],
  invalid: [
    // Forbidden: Direct process.env.X in Lambda
    {
      code: `
        const tableName = process.env.DYNAMODB_TABLE_NAME
      `,
      filename: 'src/lambdas/ListFiles/src/index.ts',
      errors: [{messageId: 'directAccess'}]
    },
    // Forbidden: Direct process.env.X in utility (user-defined env var)
    {
      code: `
        const apiKey = process.env.API_SECRET_KEY
      `,
      filename: 'src/util/helpers.ts',
      errors: [{messageId: 'directAccess'}]
    },
    // Forbidden: Multiple direct accesses
    {
      code: `
        const table = process.env.TABLE_NAME
        const bucket = process.env.BUCKET_NAME
      `,
      filename: 'src/lambdas/StartFileUpload/src/index.ts',
      errors: [
        {messageId: 'directAccess'},
        {messageId: 'directAccess'}
      ]
    }
  ]
})

console.log('env-validation: All tests passed!')
