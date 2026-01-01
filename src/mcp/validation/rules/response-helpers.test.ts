/**
 * Unit tests for response-helpers rule
 * HIGH: Lambda handlers must use buildValidatedResponse() helper, not raw objects
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let responseHelpersRule: typeof import('./response-helpers').responseHelpersRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./response-helpers')
  responseHelpersRule = module.responseHelpersRule
})

describe('response-helpers rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(responseHelpersRule.name).toBe('response-helpers')
    })

    test('should have HIGH severity', () => {
      expect(responseHelpersRule.severity).toBe('HIGH')
    })

    test('should apply to Lambda handler files', () => {
      expect(responseHelpersRule.appliesTo).toContain('src/lambdas/**/src/*.ts')
    })

    test('should exclude test files', () => {
      expect(responseHelpersRule.excludes).toContain('**/*.test.ts')
    })
  })

  describe('skips non-handler files', () => {
    test('should skip files not in lambdas directory', () => {
      const sourceFile = project.createSourceFile('test-non-lambda.ts', `export function handler() {
  return { statusCode: 200, body: JSON.stringify({success: true}) }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/util/helpers.ts')

      expect(violations).toHaveLength(0)
    })

    test('should skip non-index.ts files', () => {
      const sourceFile = project.createSourceFile('test-helper.ts', `export function buildResponse() {
  return { statusCode: 200, body: '{}' }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/helper.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('detects raw response objects', () => {
    test('should detect raw statusCode + body return', () => {
      const sourceFile = project.createSourceFile('test-raw-response.ts', `export async function handler(event: APIGatewayProxyEvent) {
  return {
    statusCode: 200,
    body: JSON.stringify({success: true})
  }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      // May have 2 violations: raw response + missing import warning
      expect(violations.length).toBeGreaterThanOrEqual(1)
      const rawResponseViolation = violations.find((v) => v.message.includes('Raw response object'))
      expect(rawResponseViolation).toBeDefined()
      expect(rawResponseViolation!.severity).toBe('HIGH')
    })

    test('should detect raw statusCode + headers return', () => {
      const sourceFile = project.createSourceFile('test-raw-headers.ts', `export async function handler(event: APIGatewayProxyEvent) {
  return {
    statusCode: 302,
    headers: { Location: 'https://example.com' }
  }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      // May have 2 violations: raw response + missing import warning
      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations.some((v) => v.message.includes('Raw response object'))).toBe(true)
    })

    test('should detect raw response with all properties', () => {
      const sourceFile = project.createSourceFile('test-raw-full.ts', `export async function handler() {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({data: []})
  }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
    })

    test('should detect error response without helper', () => {
      const sourceFile = project.createSourceFile('test-error-raw.ts', `export async function handler() {
  try {
    throw new Error('test')
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({error: 'Internal error'})
    }
  }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
    })
  })

  describe('detects Promise.resolve patterns', () => {
    test('should detect Promise.resolve with raw response', () => {
      const sourceFile = project.createSourceFile('test-promise-resolve.ts', `export async function handler() {
  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({})
  })
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThan(0)
    })
  })

  describe('allows proper response helper usage', () => {
    test('should allow buildValidatedResponse() helper', () => {
      const sourceFile = project.createSourceFile('test-response-helper.ts', `import {buildValidatedResponse} from '#lib/lambda/responses'

export async function handler() {
  return buildValidatedResponse(context, 200, {success: true})
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow buildErrorResponse() for error handling', () => {
      const sourceFile = project.createSourceFile('test-error-helper.ts', `import {buildErrorResponse} from '#lib/lambda/responses'

export async function handler() {
  try {
    return buildValidatedResponse(context, 200, {})
  } catch (error) {
    return buildErrorResponse(context, error)
  }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow returning helper result', () => {
      const sourceFile = project.createSourceFile('test-helper-result.ts', `import {buildValidatedResponse} from '#lib/lambda/responses'

export async function handler() {
  const result = await processData()
  return buildValidatedResponse(context, 200, result)
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('detects missing helper imports', () => {
    test('should warn when APIGateway handler lacks helper import', () => {
      const sourceFile = project.createSourceFile('test-missing-import.ts', `import type {APIGatewayProxyEvent} from 'aws-lambda'

export const handler = async (event: APIGatewayProxyEvent) => {
  const statusCode = 200
  return { statusCode, body: '{}' }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThan(0)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest response helper when detected', () => {
      const sourceFile = project.createSourceFile('test-suggestion.ts', `import {buildValidatedResponse} from '#lib/lambda/responses'

export async function handler() {
  return {
    statusCode: 200,
    body: JSON.stringify({})
  }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toContain('buildValidatedResponse')
    })

    test('should suggest importing helper when missing', () => {
      const sourceFile = project.createSourceFile('test-suggest-import.ts', `import type {APIGatewayProxyEvent} from 'aws-lambda'

export const handler = async (event: APIGatewayProxyEvent) => {
  return { statusCode: 200, body: '{}' }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      const hasImportSuggestion = violations.some((v) => v.suggestion && v.suggestion.includes('import'))
      expect(hasImportSuggestion).toBe(true)
    })
  })

  describe('handles multiple return statements', () => {
    test('should detect multiple raw responses', () => {
      const sourceFile = project.createSourceFile('test-multiple-returns.ts', `export async function handler(event) {
  if (!event.body) {
    return { statusCode: 400, body: 'Missing body' }
  }

  try {
    return { statusCode: 200, body: JSON.stringify({}) }
  } catch (e) {
    return { statusCode: 500, body: 'Error' }
  }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(3)
    })
  })

  describe('code snippets', () => {
    test('should include code snippet in violation', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', `export async function handler() {
  return {
    statusCode: 200,
    body: JSON.stringify({message: 'hello'})
  }
}`, {overwrite: true})

      const violations = responseHelpersRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].codeSnippet).toBeDefined()
      expect(violations[0].codeSnippet).toContain('statusCode')
    })
  })
})
