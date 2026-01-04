/**
 * Unit tests for types-location rule
 * HIGH: Exported type definitions should be in src/types/
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let typesLocationRule: typeof import('./types-location').typesLocationRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./types-location')
  typesLocationRule = module.typesLocationRule
})

describe('types-location rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(typesLocationRule.name).toBe('types-location')
    })

    test('should have HIGH severity', () => {
      expect(typesLocationRule.severity).toBe('HIGH')
    })

    test('should apply to src/**/*.ts files', () => {
      expect(typesLocationRule.appliesTo).toContain('src/**/*.ts')
    })

    test('should exclude types directory', () => {
      expect(typesLocationRule.excludes).toContain('src/types/**/*.ts')
    })

    test('should exclude entities directory', () => {
      expect(typesLocationRule.excludes).toContain('src/entities/**/*.ts')
    })

    test('should exclude mcp directory', () => {
      expect(typesLocationRule.excludes).toContain('src/mcp/**/*.ts')
    })

    test('should exclude test files', () => {
      expect(typesLocationRule.excludes).toContain('**/*.test.ts')
    })

    test('should exclude vendor files', () => {
      expect(typesLocationRule.excludes).toContain('src/lib/vendor/**/*.ts')
    })
  })

  describe('detects exported type alias', () => {
    test('should detect exported type alias in util file', () => {
      const sourceFile = project.createSourceFile('test-type-alias.ts', 'export type FooConfig = { bar: string }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/foo-helpers.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('HIGH')
      expect(violations[0].message).toContain("Exported type alias 'FooConfig'")
    })

    test('should detect multiple exported type aliases', () => {
      const sourceFile = project.createSourceFile('test-multi-types.ts', `export type Config = { value: string }
export type Options = { enabled: boolean }
export type Params = { id: number }`, {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/helpers.ts')

      expect(violations).toHaveLength(3)
    })
  })

  describe('detects exported interface', () => {
    test('should detect exported interface in util file', () => {
      const sourceFile = project.createSourceFile('test-interface.ts', 'export interface BarResult { success: boolean }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/bar-helpers.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain("Exported interface 'BarResult'")
    })

    test('should detect exported interface in lambda file', () => {
      const sourceFile = project.createSourceFile('test-lambda-interface.ts', 'export interface HandlerParams { event: object }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/lambdas/MyLambda/src/index.ts')

      expect(violations).toHaveLength(1)
    })
  })

  describe('detects exported enum', () => {
    test('should detect exported enum in util file', () => {
      const sourceFile = project.createSourceFile('test-enum.ts', 'export enum Status { Pending = "pending", Active = "active" }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/status.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain("Exported enum 'Status'")
    })
  })

  describe('allows types in src/types/ directory', () => {
    test('should allow exported types in types directory', () => {
      const sourceFile = project.createSourceFile('test-types-allowed.ts', `export type Config = { value: string }
export interface Options { enabled: boolean }
export enum Status { Active }`, {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/types/main.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow nested types in types directory', () => {
      const sourceFile = project.createSourceFile('test-types-nested.ts', 'export type VendorConfig = { apiKey: string }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/types/vendor/aws.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('allows entity-derived types in entities directory', () => {
    test('should allow types in entities directory', () => {
      const sourceFile = project.createSourceFile('test-entity-types.ts', `export type FileItem = { fileId: string }
export interface UserItem { userId: string }`, {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/entities/Files.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('allows MCP types in mcp directory', () => {
    test('should allow types in mcp directory', () => {
      const sourceFile = project.createSourceFile('test-mcp-types.ts', `export type Violation = { rule: string }
export interface ValidationRule { name: string }`, {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/mcp/validation/types.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('allows types in vendor directory', () => {
    test('should allow types in vendor directory', () => {
      const sourceFile = project.createSourceFile('test-vendor-types.ts', 'export type S3UploadResult = { bucket: string }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/lib/vendor/AWS/S3.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('ignores non-exported types', () => {
    test('should ignore internal type alias', () => {
      const sourceFile = project.createSourceFile('test-internal-type.ts', 'type InternalConfig = { value: string }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/helpers.ts')

      expect(violations).toHaveLength(0)
    })

    test('should ignore internal interface', () => {
      const sourceFile = project.createSourceFile('test-internal-interface.ts', 'interface InternalOptions { enabled: boolean }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/helpers.ts')

      expect(violations).toHaveLength(0)
    })

    test('should ignore internal enum', () => {
      const sourceFile = project.createSourceFile('test-internal-enum.ts', 'enum InternalStatus { Active }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/helpers.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('ignores test files', () => {
    test('should ignore types in test files', () => {
      const sourceFile = project.createSourceFile('test-in-test.ts', 'export type MockConfig = { value: string }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/helpers.test.ts')

      expect(violations).toHaveLength(0)
    })

    test('should ignore types in test directory', () => {
      const sourceFile = project.createSourceFile('test-in-test-dir.ts', 'export interface TestFixture { data: object }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'test/helpers/fixtures.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest lambda-wrappers.ts for lambda-helpers file', () => {
      const sourceFile = project.createSourceFile('test-suggestion-lambda.ts', 'export type HandlerParams = { event: object }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/lambda-helpers.ts')

      expect(violations[0].suggestion).toContain('src/types/lambda.ts')
    })

    test('should suggest video.ts for errorClassifier file', () => {
      const sourceFile = project.createSourceFile('test-suggestion-video.ts', 'export type VideoError = { message: string }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/lib/domain/video/errorClassifier.ts')

      expect(violations[0].suggestion).toContain('video.ts')
    })

    test('should suggest util.ts for retry file', () => {
      const sourceFile = project.createSourceFile('test-suggestion-retry.ts', 'export interface RetryConfig { maxRetries: number }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/retry.ts')

      expect(violations[0].suggestion).toContain('util.ts')
    })

    test('should suggest main.ts for unknown files', () => {
      const sourceFile = project.createSourceFile('test-suggestion-unknown.ts', 'export type SomeType = { value: string }', {overwrite: true})

      const violations = typesLocationRule.validate(sourceFile, 'src/util/unknown.ts')

      expect(violations[0].suggestion).toContain('main.ts')
    })
  })

  describe('includes code context', () => {
    test('should include code snippet in violation', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', 'export type ConfigWithLongName = { value: string; enabled: boolean }', {
        overwrite: true
      })

      const violations = typesLocationRule.validate(sourceFile, 'src/util/helpers.ts')

      expect(violations[0].codeSnippet).toBeDefined()
      expect(violations[0].codeSnippet).toContain('ConfigWithLongName')
    })
  })
})
