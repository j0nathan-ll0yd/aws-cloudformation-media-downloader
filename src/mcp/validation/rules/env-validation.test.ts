/**
 * Unit tests for env-validation rule
 * CRITICAL: No direct process.env access without getRequiredEnv() wrapper
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let envValidationRule: typeof import('./env-validation').envValidationRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./env-validation')
  envValidationRule = module.envValidationRule
})

describe('env-validation rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(envValidationRule.name).toBe('env-validation')
    })

    test('should have CRITICAL severity', () => {
      expect(envValidationRule.severity).toBe('CRITICAL')
    })

    test('should apply to Lambda and util files', () => {
      expect(envValidationRule.appliesTo).toContain('src/lambdas/**/src/*.ts')
      expect(envValidationRule.appliesTo).toContain('src/util/*.ts')
    })

    test('should exclude test files and env-validation.ts itself', () => {
      expect(envValidationRule.excludes).toContain('src/**/*.test.ts')
      expect(envValidationRule.excludes).toContain('src/util/env-validation.ts')
    })
  })

  describe('detects direct process.env access', () => {
    test('should detect process.env.VARIABLE_NAME', () => {
      const sourceFile = project.createSourceFile(
        'test-env.ts',
        `const region = process.env.AWS_REGION
export const handler = () => region`,
        {overwrite: true}
      )

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('CRITICAL')
      expect(violations[0].message).toContain('AWS_REGION')
    })

    test('should detect multiple process.env accesses', () => {
      const sourceFile = project.createSourceFile(
        'test-multi-env.ts',
        `const region = process.env.AWS_REGION
const bucket = process.env.S3_BUCKET_NAME
const table = process.env.DYNAMODB_TABLE_NAME`,
        {overwrite: true}
      )

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(3)
    })

    test('should detect process.env in function body', () => {
      const sourceFile = project.createSourceFile(
        'test-func-env.ts',
        `export function getConfig() {
  return process.env.MY_CONFIG
}`,
        {overwrite: true}
      )

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('MY_CONFIG')
    })
  })

  describe('detects bracket notation access', () => {
    test('should detect process.env["VARIABLE"]', () => {
      const sourceFile = project.createSourceFile('test-bracket.ts', 'const value = process.env["MY_VAR"]', {overwrite: true})

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('bracket')
    })

    test("should detect process.env['VARIABLE']", () => {
      const sourceFile = project.createSourceFile('test-bracket-single.ts', "const value = process.env['MY_VAR']", {overwrite: true})

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('allows valid patterns', () => {
    test('should allow getRequiredEnv() helper', () => {
      const sourceFile = project.createSourceFile(
        'test-valid.ts',
        `import {getRequiredEnv} from '#util/env-validation'
const region = getRequiredEnv('AWS_REGION')`,
        {overwrite: true}
      )

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow getRequiredEnvNumber() helper', () => {
      const sourceFile = project.createSourceFile(
        'test-valid-number.ts',
        `import {getRequiredEnvNumber} from '#util/env-validation'
const timeout = getRequiredEnvNumber('TIMEOUT_MS')`,
        {overwrite: true}
      )

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow code without process.env', () => {
      const sourceFile = project.createSourceFile(
        'test-no-env.ts',
        `import {Users} from '#entities/Users'
export const handler = async () => {
  return await Users.get({userId: '123'}).go()
}`,
        {overwrite: true}
      )

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('skips excluded files', () => {
    test('should skip env-validation.ts file', () => {
      const sourceFile = project.createSourceFile('test-self.ts', "const x = process.env.NODE_ENV || 'development'", {overwrite: true})

      const violations = envValidationRule.validate(sourceFile, 'src/util/env-validation.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest getRequiredEnv for known env vars', () => {
      const sourceFile = project.createSourceFile('test-suggestion.ts', 'const region = process.env.AWS_REGION', {overwrite: true})

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toContain("getRequiredEnv('AWS_REGION')")
    })

    test('should include code snippet in violation', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', 'const bucket = process.env.S3_BUCKET_NAME', {overwrite: true})

      const violations = envValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].codeSnippet).toBeDefined()
      expect(violations[0].codeSnippet).toContain('process.env.S3_BUCKET_NAME')
    })
  })
})
