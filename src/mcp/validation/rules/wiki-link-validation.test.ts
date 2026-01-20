/**
 * Unit tests for wiki-link-validation rule
 * HIGH: Validates that markdown links in documentation point to existing files
 */

import {beforeAll, describe, expect, test, vi} from 'vitest'
import {Project} from 'ts-morph'
import fs from 'fs'

// Module loaded via dynamic import
let wikiLinkValidationRule: typeof import('./wiki-link-validation').wikiLinkValidationRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./wiki-link-validation')
  wikiLinkValidationRule = module.wikiLinkValidationRule
})

function createSourceFile(content: string) {
  return project.createSourceFile(`test-${Date.now()}.ts`, content, {overwrite: true})
}

describe('wiki-link-validation rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(wikiLinkValidationRule.name).toBe('wiki-link-validation')
    })

    test('should have HIGH severity', () => {
      expect(wikiLinkValidationRule.severity).toBe('HIGH')
    })

    test('should apply to AGENTS.md', () => {
      expect(wikiLinkValidationRule.appliesTo).toContain('AGENTS.md')
    })

    test('should apply to docs/wiki/**/*.md', () => {
      expect(wikiLinkValidationRule.appliesTo).toContain('docs/wiki/**/*.md')
    })

    test('should apply to CLAUDE.md', () => {
      expect(wikiLinkValidationRule.appliesTo).toContain('CLAUDE.md')
    })
  })

  describe('link detection', () => {
    test('should ignore external URLs', () => {
      // Mock fs.existsSync and fs.readFileSync
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'readFileSync').mockReturnValue('[External Link](https://example.com)')

      const sourceFile = createSourceFile('')
      const violations = wikiLinkValidationRule.validate(sourceFile, 'docs/wiki/Test.md')

      // Should have no violations for external links
      expect(violations.filter((v) => v.message.includes('example.com'))).toHaveLength(0)

      vi.restoreAllMocks()
    })

    test('should ignore anchor-only links', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'readFileSync').mockReturnValue('[Jump to section](#some-section)')

      const sourceFile = createSourceFile('')
      const violations = wikiLinkValidationRule.validate(sourceFile, 'docs/wiki/Test.md')

      expect(violations.filter((v) => v.message.includes('#some-section'))).toHaveLength(0)

      vi.restoreAllMocks()
    })

    test('should ignore mailto links', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'readFileSync').mockReturnValue('[Email](mailto:test@example.com)')

      const sourceFile = createSourceFile('')
      const violations = wikiLinkValidationRule.validate(sourceFile, 'docs/wiki/Test.md')

      expect(violations.filter((v) => v.message.includes('mailto'))).toHaveLength(0)

      vi.restoreAllMocks()
    })

    test('should detect broken relative links', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        // Only the source file exists, not the linked file
        if (typeof p === 'string' && p.endsWith('Test.md')) {
          return true
        }
        return false
      })
      vi.spyOn(fs, 'readFileSync').mockReturnValue('[Broken Link](./non-existent-file.md)')

      const sourceFile = createSourceFile('')
      const violations = wikiLinkValidationRule.validate(sourceFile, 'docs/wiki/Test.md')

      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('Broken link')
      expect(violations[0].message).toContain('non-existent-file.md')

      vi.restoreAllMocks()
    })

    test('should not flag valid relative links', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'readFileSync').mockReturnValue('[Valid Link](./existing-file.md)')

      const sourceFile = createSourceFile('')
      const violations = wikiLinkValidationRule.validate(sourceFile, 'docs/wiki/Test.md')

      expect(violations).toHaveLength(0)

      vi.restoreAllMocks()
    })

    test('should handle links with anchors', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)
      vi.spyOn(fs, 'readFileSync').mockReturnValue('[Link with Anchor](./existing-file.md#section)')

      const sourceFile = createSourceFile('')
      const violations = wikiLinkValidationRule.validate(sourceFile, 'docs/wiki/Test.md')

      expect(violations).toHaveLength(0)

      vi.restoreAllMocks()
    })

    test('should report correct line numbers', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('Test.md')) {
          return true
        }
        return false
      })
      vi.spyOn(fs, 'readFileSync').mockReturnValue('Line 1\nLine 2\n[Broken](./broken.md)\nLine 4')

      const sourceFile = createSourceFile('')
      const violations = wikiLinkValidationRule.validate(sourceFile, 'docs/wiki/Test.md')

      expect(violations.length).toBe(1)
      expect(violations[0].line).toBe(3)

      vi.restoreAllMocks()
    })
  })

  describe('multiple links', () => {
    test('should check all links in a file', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('Test.md')) {
          return true
        }
        return false
      })
      vi.spyOn(fs, 'readFileSync').mockReturnValue('[Link 1](./broken1.md)\n[Link 2](./broken2.md)')

      const sourceFile = createSourceFile('')
      const violations = wikiLinkValidationRule.validate(sourceFile, 'docs/wiki/Test.md')

      expect(violations.length).toBe(2)

      vi.restoreAllMocks()
    })

    test('should deduplicate violations for the same link', () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (typeof p === 'string' && p.endsWith('Test.md')) {
          return true
        }
        return false
      })
      vi.spyOn(fs, 'readFileSync').mockReturnValue('[Link 1](./broken.md)\n[Link 2](./broken.md)')

      const sourceFile = createSourceFile('')
      const violations = wikiLinkValidationRule.validate(sourceFile, 'docs/wiki/Test.md')

      // Should only report once per unique link path
      expect(violations.length).toBe(1)

      vi.restoreAllMocks()
    })
  })

  describe('file path patterns', () => {
    test('should ignore files outside the appliesTo patterns', () => {
      const sourceFile = createSourceFile('')
      // This path doesn't match any appliesTo pattern, so the rule should be skipped
      // (handled by the validation framework, but we test that validate returns empty for non-md)
      const violations = wikiLinkValidationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      // Even if called directly, source files don't have links
      expect(violations).toHaveLength(0)
    })
  })
})
