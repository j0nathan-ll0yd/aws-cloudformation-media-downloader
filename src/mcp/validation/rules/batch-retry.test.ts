/**
 * Unit tests for batch-retry rule
 * HIGH: Enforce retry handling for batch operations
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

let batchRetryRule: typeof import('./batch-retry').batchRetryRule

const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./batch-retry')
  batchRetryRule = module.batchRetryRule
})

describe('batch-retry rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(batchRetryRule.name).toBe('batch-retry')
    })

    test('should have HIGH severity', () => {
      expect(batchRetryRule.severity).toBe('HIGH')
    })
  })

  describe('detects unprotected batch operations', () => {
    test('should detect batchGet without retry wrapper', () => {
      const sourceFile = project.createSourceFile('test-batch.ts', 'const results = await Users.batchGet(items).go()', {overwrite: true})

      const violations = batchRetryRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('batchGet')
    })

    test('should detect batchWrite without retry wrapper', () => {
      const sourceFile = project.createSourceFile('test-batch-write.ts', 'await Users.batchWrite(items).go()', {overwrite: true})

      const violations = batchRetryRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('allows valid patterns', () => {
    test('should allow retryUnprocessed wrapper', () => {
      const sourceFile = project.createSourceFile('test-retry.ts', 'const results = await retryUnprocessed(Users.batchGet(items))', {overwrite: true})

      const violations = batchRetryRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should skip retry.ts utility file', () => {
      const sourceFile = project.createSourceFile('test-self.ts', 'const results = await Users.batchGet(items).go()', {overwrite: true})

      const violations = batchRetryRule.validate(sourceFile, 'src/util/retry.ts')

      expect(violations).toHaveLength(0)
    })
  })
})
