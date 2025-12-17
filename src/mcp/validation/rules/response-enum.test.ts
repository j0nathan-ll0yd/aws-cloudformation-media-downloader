/**
 * Unit tests for response-enum rule
 * MEDIUM: Enforce ResponseStatus enum usage
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

let responseEnumRule: typeof import('./response-enum').responseEnumRule

const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./response-enum')
  responseEnumRule = module.responseEnumRule
})

describe('response-enum rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(responseEnumRule.name).toBe('response-enum')
    })

    test('should have MEDIUM severity', () => {
      expect(responseEnumRule.severity).toBe('MEDIUM')
    })
  })

  describe('detects magic strings', () => {
    test('should detect status: "success" pattern', () => {
      const sourceFile = project.createSourceFile('test-magic.ts', "return response(200, { status: 'success', data: result })", {overwrite: true})

      const violations = responseEnumRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('success')
    })

    test('should detect status: "error" pattern', () => {
      const sourceFile = project.createSourceFile('test-error.ts', "return { status: 'error', message: 'Failed' }", {overwrite: true})

      const violations = responseEnumRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('allows valid patterns', () => {
    test('should allow ResponseStatus enum', () => {
      const sourceFile = project.createSourceFile('test-enum.ts', 'return response(200, { status: ResponseStatus.Success })', {overwrite: true})

      const violations = responseEnumRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow non-status string literals', () => {
      const sourceFile = project.createSourceFile('test-other.ts', "return { message: 'Operation successful', data: [] }", {overwrite: true})

      const violations = responseEnumRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      // Should not flag 'successful' in message property
      const statusViolations = violations.filter((v) => v.message.includes('status'))
      expect(statusViolations).toHaveLength(0)
    })
  })
})
