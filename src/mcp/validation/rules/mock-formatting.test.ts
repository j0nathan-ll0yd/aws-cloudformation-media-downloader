/**
 * Unit tests for mock-formatting rule
 * MEDIUM: Enforce separate statements for mock return values
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

let mockFormattingRule: typeof import('./mock-formatting').mockFormattingRule

const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./mock-formatting')
  mockFormattingRule = module.mockFormattingRule
})

describe('mock-formatting rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(mockFormattingRule.name).toBe('mock-formatting')
    })

    test('should have MEDIUM severity', () => {
      expect(mockFormattingRule.severity).toBe('MEDIUM')
    })

    test('should apply to test files', () => {
      expect(mockFormattingRule.appliesTo).toContain('src/**/*.test.ts')
    })
  })

  describe('detects chained mock calls', () => {
    test('should detect chained mockResolvedValueOnce', () => {
      const sourceFile = project.createSourceFile('test-chain.ts', 'mockFn.mockResolvedValueOnce(a).mockResolvedValueOnce(b)', {overwrite: true})

      const violations = mockFormattingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('Chained mock return values')
    })

    test('should detect chained mockReturnValueOnce', () => {
      const sourceFile = project.createSourceFile('test-return-chain.ts', 'mockFn.mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3)', {
        overwrite: true
      })

      const violations = mockFormattingRule.validate(sourceFile, 'test/helpers/test.ts')

      expect(violations.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('allows valid patterns', () => {
    test('should allow separate mock statements', () => {
      const sourceFile = project.createSourceFile('test-separate.ts', `mockFn.mockResolvedValueOnce(a)
mockFn.mockResolvedValueOnce(b)`, {overwrite: true})

      const violations = mockFormattingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow single mock call', () => {
      const sourceFile = project.createSourceFile('test-single.ts', 'mockFn.mockResolvedValueOnce(result)', {overwrite: true})

      const violations = mockFormattingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow mockResolvedValue (not Once)', () => {
      const sourceFile = project.createSourceFile('test-resolved.ts', 'mockFn.mockResolvedValue(defaultResult)', {overwrite: true})

      const violations = mockFormattingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(0)
    })
  })
})
