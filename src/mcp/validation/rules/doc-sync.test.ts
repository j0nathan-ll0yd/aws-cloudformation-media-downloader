/**
 * Unit tests for doc-sync rule
 * HIGH: Validates source code patterns match documentation expectations
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let docSyncRule: typeof import('./doc-sync').docSyncRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./doc-sync')
  docSyncRule = module.docSyncRule
})

describe('doc-sync rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(docSyncRule.name).toBe('doc-sync')
    })

    test('should have HIGH severity', () => {
      expect(docSyncRule.severity).toBe('HIGH')
    })

    test('should apply to src/**/*.ts files', () => {
      expect(docSyncRule.appliesTo).toContain('src/**/*.ts')
    })

    test('should exclude test files', () => {
      expect(docSyncRule.excludes).toContain('**/*.test.ts')
    })
  })

  describe('stale import patterns', () => {
    test('should detect old vendor path without src/ prefix', () => {
      const sourceFile = project.createSourceFile('old-vendor-path.ts', `import {queryItems} from 'lib/vendor/AWS/DynamoDB'`, {overwrite: true})

      const violations = docSyncRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.some((v) => v.message.includes('Old vendor path without src/ prefix'))).toBe(true)
    })

    test('should accept correct vendor path with # prefix', () => {
      const sourceFile = project.createSourceFile('correct-vendor-path.ts', `import {queryItems} from '#lib/vendor/AWS/DynamoDB'`, {overwrite: true})

      const violations = docSyncRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.filter((v) => v.message.includes('vendor path')).length).toBe(0)
    })

    test('should detect Prettier reference', () => {
      const sourceFile = project.createSourceFile('prettier-ref.ts', `// TODO: Update Prettier config
import {formatPrettier} from 'prettier'`, {overwrite: true})

      const violations = docSyncRule.validate(sourceFile, 'src/util/format.ts')

      expect(violations.some((v) => v.message.includes('Prettier reference'))).toBe(true)
    })
  })

  describe('undocumented vendor paths', () => {
    test('should detect import from undocumented vendor path', () => {
      const sourceFile = project.createSourceFile('undoc-vendor.ts', `import {something} from '#lib/vendor/UnknownService/Client'`, {overwrite: true})

      const violations = docSyncRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.some((v) => v.message.includes('undocumented vendor path'))).toBe(true)
    })

    test('should accept documented vendor paths', () => {
      const sourceFile = project.createSourceFile('doc-vendor.ts', `import {queryItems} from '#lib/vendor/AWS/DynamoDB'
import {getAuth} from '#lib/vendor/BetterAuth/client'
import {db} from '#lib/vendor/Drizzle/client'`, {overwrite: true})

      const violations = docSyncRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.filter((v) => v.message.includes('undocumented vendor path')).length).toBe(0)
    })

    test('should accept YouTube vendor path', () => {
      const sourceFile = project.createSourceFile('youtube-vendor.ts', `import {downloadVideo} from '#lib/vendor/YouTube'`, {overwrite: true})

      const violations = docSyncRule.validate(sourceFile, 'src/lambdas/StartFileUpload/src/index.ts')

      expect(violations.filter((v) => v.message.includes('undocumented vendor path')).length).toBe(0)
    })
  })

  describe('MCP rule count validation', () => {
    test('should detect MCP rule count mismatch in index.ts', () => {
      // Create a mock validation/index.ts with wrong count
      const sourceFile = project.createSourceFile('validation-index.ts', `import {rule1} from './rules/rule1'
import {rule2} from './rules/rule2'

export const allRules = [rule1, rule2]`, {overwrite: true})

      const violations = docSyncRule.validate(sourceFile, 'src/mcp/validation/index.ts')

      // Should detect mismatch (2 rules vs expected 20)
      expect(violations.some((v) => v.message.includes('MCP rule count mismatch'))).toBe(true)
    })

    test('should not check rule count for non-index files', () => {
      const sourceFile = project.createSourceFile('other-file.ts', `export const allRules = [rule1, rule2]`, {overwrite: true})

      const violations = docSyncRule.validate(sourceFile, 'src/mcp/validation/something-else.ts')

      // Should not check rule count for other files
      expect(violations.filter((v) => v.message.includes('MCP rule count mismatch')).length).toBe(0)
    })
  })

  describe('non-typescript files', () => {
    test('should skip stale pattern checks for non-ts files', () => {
      const sourceFile = project.createSourceFile('readme.md', `# Readme
Some content about lib/vendor/ paths`, {overwrite: true})

      const violations = docSyncRule.validate(sourceFile, 'docs/README.md')

      // Markdown files don't get TypeScript pattern checks
      expect(violations.filter((v) => v.message.includes('Old vendor path')).length).toBe(0)
    })
  })
})
