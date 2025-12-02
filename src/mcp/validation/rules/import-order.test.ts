/**
 * Unit tests for import-order rule
 * MEDIUM: Imports should be grouped and ordered consistently
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let importOrderRule: typeof import('./import-order').importOrderRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./import-order')
  importOrderRule = module.importOrderRule
})

describe('import-order rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(importOrderRule.name).toBe('import-order')
    })

    test('should have MEDIUM severity', () => {
      expect(importOrderRule.severity).toBe('MEDIUM')
    })

    test('should apply to Lambda handler files', () => {
      expect(importOrderRule.appliesTo).toContain('src/lambdas/**/src/*.ts')
    })

    test('should exclude test files', () => {
      expect(importOrderRule.excludes).toContain('**/*.test.ts')
    })
  })

  describe('skips non-handler files', () => {
    test('should skip files not in lambdas directory', () => {
      const sourceFile = project.createSourceFile('test-util.ts', `import {v4} from 'uuid'
import {Users} from '#entities/Users'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/util/helpers.ts')

      expect(violations).toHaveLength(0)
    })

    test('should skip non-index.ts files', () => {
      const sourceFile = project.createSourceFile('test-helper.ts', `import {Users} from '#entities/Users'
import type {APIGatewayProxyEvent} from 'aws-lambda'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/helper.ts')

      expect(violations).toHaveLength(0)
    })

    test('should skip files with less than 2 imports', () => {
      const sourceFile = project.createSourceFile('test-single.ts', 'import {Users} from \'#entities/Users\'', {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('validates correct import order', () => {
    test('should allow correct order: aws-lambda → external → entities', () => {
      const sourceFile = project.createSourceFile('test-correct-order.ts', `import type {APIGatewayProxyEvent} from 'aws-lambda'
import {v4} from 'uuid'
import {Users} from '#entities/Users'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow correct order: node builtins → external → vendor → utilities', () => {
      const sourceFile = project.createSourceFile('test-full-order.ts', `import {readFile} from 'node:fs'
import {v4} from 'uuid'
import {queryItems} from '#lib/vendor/AWS/DynamoDB'
import {response} from '#util/lambda-helpers'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow correct full order', () => {
      const sourceFile = project.createSourceFile('test-complete-order.ts', `import {join} from 'node:path'
import type {APIGatewayProxyEvent} from 'aws-lambda'
import {v4} from 'uuid'
import {Users} from '#entities/Users'
import {queryItems} from '#lib/vendor/AWS/DynamoDB'
import type {UserRecord} from '#types/User'
import {response} from '#util/lambda-helpers'
import {helper} from './helper'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('detects incorrect import order', () => {
    test('should detect entities before external packages', () => {
      const sourceFile = project.createSourceFile('test-wrong-order-1.ts', `import {Users} from '#entities/Users'
import {v4} from 'uuid'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('MEDIUM')
    })

    test('should detect utilities before vendor', () => {
      const sourceFile = project.createSourceFile('test-wrong-order-2.ts', `import {response} from '#util/lambda-helpers'
import {queryItems} from '#lib/vendor/AWS/DynamoDB'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
    })

    test('should detect aws-lambda after external packages', () => {
      const sourceFile = project.createSourceFile('test-wrong-order-3.ts', `import {v4} from 'uuid'
import type {APIGatewayProxyEvent} from 'aws-lambda'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('aws-lambda')
    })
  })

  describe('detects non-grouped imports', () => {
    test('should detect entities appearing non-consecutively', () => {
      const sourceFile = project.createSourceFile('test-non-grouped.ts', `import {Users} from '#entities/Users'
import {response} from '#util/lambda-helpers'
import {Files} from '#entities/Files'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      // Should detect both out-of-order and non-grouped
      expect(violations.length).toBeGreaterThan(0)
    })

    test('should detect vendor imports split apart', () => {
      const sourceFile = project.createSourceFile('test-split-vendor.ts', `import {queryItems} from '#lib/vendor/AWS/DynamoDB'
import {response} from '#util/lambda-helpers'
import {uploadToS3} from '#lib/vendor/AWS/S3'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations.some((v) => v.message.includes('grouped'))).toBe(true)
    })
  })

  describe('categorizes imports correctly', () => {
    test('should recognize node: prefix as builtin', () => {
      const sourceFile = project.createSourceFile('test-node-prefix.ts', `import {Users} from '#entities/Users'
import {readFile} from 'node:fs'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('node-builtins')
    })

    test('should recognize @scope packages as external', () => {
      const sourceFile = project.createSourceFile('test-scoped.ts', `import {Users} from '#entities/Users'
import {something} from '@scope/package'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
    })

    test('should recognize #types as types category', () => {
      const sourceFile = project.createSourceFile('test-types.ts', `import {response} from '#util/lambda-helpers'
import type {UserRecord} from '#types/User'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
    })

    test('should recognize relative imports', () => {
      const sourceFile = project.createSourceFile('test-relative.ts', `import {helper} from './helper'
import {response} from '#util/lambda-helpers'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest moving import to correct section', () => {
      const sourceFile = project.createSourceFile('test-suggestion.ts', `import {Users} from '#entities/Users'
import type {APIGatewayProxyEvent} from 'aws-lambda'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toBeDefined()
      expect(violations[0].suggestion).toContain('Move')
    })

    test('should include code snippet', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', `import {queryItems} from '#lib/vendor/AWS/DynamoDB'
import {v4} from 'uuid'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].codeSnippet).toBeDefined()
    })
  })

  describe('handles edge cases', () => {
    test('should handle same category imports correctly', () => {
      const sourceFile = project.createSourceFile('test-same-category.ts', `import {Users} from '#entities/Users'
import {Files} from '#entities/Files'
import {Devices} from '#entities/Devices'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should handle multiple external packages', () => {
      const sourceFile = project.createSourceFile('test-multi-external.ts', `import {v4} from 'uuid'
import axios from 'axios'
import {format} from 'date-fns'`, {overwrite: true})

      const violations = importOrderRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })
  })
})
