/**
 * Tests for response-helpers ESLint rule
 */

const {RuleTester} = require('eslint')
const rule = require('../rules/response-helpers.cjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
})

ruleTester.run('response-helpers', rule, {
  valid: [
    // Allowed: Using buildValidatedResponse() helper
    {
      code: `
        import {buildValidatedResponse} from '#lib/lambda/responses'
        export const handler = async () => {
          return buildValidatedResponse(context, 200, {data: 'test'})
        }
      `,
      filename: 'src/lambdas/ListFiles/src/index.ts'
    },
    // Allowed: Using buildErrorResponse() for error handling
    {
      code: `
        import {buildErrorResponse} from '#lib/lambda/responses'
        export const handler = async () => {
          try {
            return buildValidatedResponse(context, 200, {})
          } catch (error) {
            return buildErrorResponse(context, error)
          }
        }
      `,
      filename: 'src/lambdas/ListFiles/src/index.ts'
    },
    // Allowed: Non-Lambda file
    {
      code: `
        export function something() {
          return {statusCode: 200, body: 'test'}
        }
      `,
      filename: 'src/util/helpers.ts'
    },
    // Allowed: Test file
    {
      code: `
        const mockResponse = {statusCode: 200, body: JSON.stringify({data: 'test'})}
      `,
      filename: 'src/lambdas/ListFiles/test/index.test.ts'
    },
    // Allowed: Return without statusCode
    {
      code: `
        export const handler = async () => {
          return {success: true, data: []}
        }
      `,
      filename: 'src/lambdas/ListFiles/src/index.ts'
    }
  ],
  invalid: [
    // Forbidden: Raw response object with statusCode and body
    {
      code: `
        export const handler = async () => {
          return {statusCode: 200, body: JSON.stringify({data: 'test'})}
        }
      `,
      filename: 'src/lambdas/ListFiles/src/index.ts',
      errors: [{messageId: 'rawResponse'}]
    },
    // Forbidden: Raw response object with statusCode and headers
    {
      code: `
        export const handler = async () => {
          return {statusCode: 200, headers: {'Content-Type': 'application/json'}, body: '{}'}
        }
      `,
      filename: 'src/lambdas/LoginUser/src/index.ts',
      errors: [{messageId: 'rawResponse'}]
    },
    // Forbidden: Raw error response
    {
      code: `
        export const handler = async () => {
          return {statusCode: 500, body: JSON.stringify({error: 'Failed'})}
        }
      `,
      filename: 'src/lambdas/RegisterUser/src/index.ts',
      errors: [{messageId: 'rawResponse'}]
    }
  ]
})

console.log('response-helpers: All tests passed!')
