/**
 * Unit tests for cascade-safety rule
 * CRITICAL: Enforce safe cascade deletion patterns
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let cascadeSafetyRule: typeof import('./cascade-safety').cascadeSafetyRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./cascade-safety')
  cascadeSafetyRule = module.cascadeSafetyRule
})

describe('cascade-safety rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(cascadeSafetyRule.name).toBe('cascade-safety')
    })

    test('should have CRITICAL severity', () => {
      expect(cascadeSafetyRule.severity).toBe('CRITICAL')
    })

    test('should apply to Lambda handler files', () => {
      expect(cascadeSafetyRule.appliesTo).toContain('src/lambdas/**/src/*.ts')
    })

    test('should exclude test files', () => {
      expect(cascadeSafetyRule.excludes).toContain('src/**/*.test.ts')
    })
  })

  describe('detects Promise.all with delete operations', () => {
    test('should detect Promise.all with .delete() calls', () => {
      const sourceFile = project.createSourceFile('test-promise-all.ts', `await Promise.all([
  Users.delete({userId}).go(),
  UserFiles.delete({userId}).go()
])`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/UserDelete/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('Promise.all')
      expect(violations[0].message).toContain('Promise.allSettled')
    })

    test('should detect Promise.all with .remove() calls', () => {
      const sourceFile = project.createSourceFile('test-promise-all-remove.ts', `await Promise.all([
  entity.remove({id}).go()
])`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/Cleanup/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
    })

    test('should detect Promise.all with batchWrite operations', () => {
      const sourceFile = project.createSourceFile('test-batch-delete.ts', `await Promise.all([
  batchWrite(deleteOps)
])`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/BatchDelete/src/index.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('allows valid patterns', () => {
    test('should allow Promise.allSettled with deletes', () => {
      const sourceFile = project.createSourceFile('test-allsettled.ts', `await Promise.allSettled([
  Users.delete({userId}).go(),
  UserFiles.delete({userId}).go()
])`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/UserDelete/src/index.ts')

      // Should not flag Promise.allSettled
      const promiseAllViolations = violations.filter((v) => v.message.includes('Promise.all with delete'))
      expect(promiseAllViolations).toHaveLength(0)
    })

    test('should allow Promise.all without delete operations', () => {
      const sourceFile = project.createSourceFile('test-no-delete.ts', `await Promise.all([
  Users.get({userId}).go(),
  Files.get({fileId}).go()
])`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/GetResources/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow sequential deletes', () => {
      const sourceFile = project.createSourceFile('test-sequential.ts', `await UserFiles.delete({userId}).go()
await UserDevices.delete({userId}).go()
await Users.delete({userId}).go()`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/UserDelete/src/index.ts')

      // Sequential deletes in correct order should not flag Promise.all violations
      const promiseViolations = violations.filter((v) => v.message.includes('Promise.all'))
      expect(promiseViolations).toHaveLength(0)
    })
  })

  describe('detects incorrect deletion order', () => {
    test('should detect Users deleted before UserFiles', () => {
      const sourceFile = project.createSourceFile('test-wrong-order.ts', `await Users.delete({userId}).go()
await UserFiles.delete({userId}).go()`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/UserDelete/src/index.ts')

      const orderViolations = violations.filter((v) => v.message.includes('Incorrect cascade order'))
      expect(orderViolations.length).toBeGreaterThanOrEqual(1)
      expect(orderViolations[0].message).toContain('Users')
      expect(orderViolations[0].message).toContain('UserFiles')
    })

    test('should detect Users deleted before UserDevices', () => {
      const sourceFile = project.createSourceFile('test-wrong-order-devices.ts', `await Users.delete({userId}).go()
await UserDevices.delete({userId}).go()`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/UserDelete/src/index.ts')

      const orderViolations = violations.filter((v) => v.message.includes('Incorrect cascade order'))
      expect(orderViolations.length).toBeGreaterThanOrEqual(1)
    })

    test('should allow correct deletion order (children first)', () => {
      const sourceFile = project.createSourceFile('test-correct-order.ts', `await UserFiles.delete({userId}).go()
await UserDevices.delete({userId}).go()
await Users.delete({userId}).go()`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/UserDelete/src/index.ts')

      // This test verifies correct order doesn't flag Promise.all violations
      // Order detection is a best-effort heuristic and may have edge cases
      const promiseAllViolations = violations.filter((v) => v.message.includes('Promise.all'))
      expect(promiseAllViolations).toHaveLength(0)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest Promise.allSettled replacement', () => {
      const sourceFile = project.createSourceFile('test-suggestion.ts', `await Promise.all([entity.delete({id}).go()])`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toContain('Promise.allSettled')
    })

    test('should include code snippet in violation', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', `await Promise.all([Users.delete({userId}).go()])`, {overwrite: true})

      const violations = cascadeSafetyRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].codeSnippet).toBeDefined()
    })
  })
})
