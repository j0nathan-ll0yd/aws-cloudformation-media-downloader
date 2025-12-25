/**
 * Unit tests for docs-structure validation rule
 * HIGH: Enforces documentation directory conventions
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let docsStructureRule: typeof import('./docs-structure').docsStructureRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./docs-structure')
  docsStructureRule = module.docsStructureRule
})

function createSourceFile(content: string) {
  return project.createSourceFile(`test-${Date.now()}.ts`, content, {overwrite: true})
}

describe('docs-structure rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(docsStructureRule.name).toBe('docs-structure')
    })

    test('should have HIGH severity', () => {
      expect(docsStructureRule.severity).toBe('HIGH')
    })

    test('should apply to docs/**/*', () => {
      expect(docsStructureRule.appliesTo).toContain('docs/**/*')
    })

    test('should exclude docs/wiki/**', () => {
      expect(docsStructureRule.excludes).toContain('docs/wiki/**')
    })
  })

  describe('docs/ root validation', () => {
    test('allows doc-code-mapping.json in docs/ root', () => {
      const sourceFile = createSourceFile('{}')
      const violations = docsStructureRule.validate(sourceFile, 'docs/doc-code-mapping.json')
      expect(violations).toHaveLength(0)
    })

    test('allows llms.txt in docs/ root', () => {
      const sourceFile = createSourceFile('content')
      const violations = docsStructureRule.validate(sourceFile, 'docs/llms.txt')
      expect(violations).toHaveLength(0)
    })

    test('allows terraform.md in docs/ root (auto-generated)', () => {
      const sourceFile = createSourceFile('# Terraform')
      const violations = docsStructureRule.validate(sourceFile, 'docs/terraform.md')
      expect(violations).toHaveLength(0)
    })

    test('flags markdown files in docs/ root (should be in wiki/)', () => {
      const sourceFile = createSourceFile('# Some Doc')
      const violations = docsStructureRule.validate(sourceFile, 'docs/README.md')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('HIGH')
      expect(violations[0].message).toContain('should be in docs/wiki/')
    })

    test('flags unexpected files in docs/ root', () => {
      const sourceFile = createSourceFile('{}')
      const violations = docsStructureRule.validate(sourceFile, 'docs/random.json')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('MEDIUM')
      expect(violations[0].message).toContain('Unexpected file')
    })
  })

  describe('docs/ subdirectory validation', () => {
    test('allows files in docs/wiki/', () => {
      // This rule excludes docs/wiki/** so it should return empty for these paths
      const sourceFile = createSourceFile('# Wiki Page')
      const violations = docsStructureRule.validate(sourceFile, 'docs/wiki/Meta/Test.md')
      expect(violations).toHaveLength(0)
    })

    test('flags unknown subdirectories', () => {
      const sourceFile = createSourceFile('# Archived')
      const violations = docsStructureRule.validate(sourceFile, 'docs/archive/old.md')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('Unexpected subdirectory')
      expect(violations[0].message).toContain('docs/archive/')
    })

    test('flags plans directory (should not exist)', () => {
      const sourceFile = createSourceFile('# Plan')
      const violations = docsStructureRule.validate(sourceFile, 'docs/plans/some-plan.md')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('Unexpected subdirectory')
    })
  })

  describe('non-docs paths', () => {
    test('ignores files outside docs/', () => {
      const sourceFile = createSourceFile('const x = 1')
      const violations = docsStructureRule.validate(sourceFile, 'src/lib/utils.ts')
      expect(violations).toHaveLength(0)
    })
  })
})
