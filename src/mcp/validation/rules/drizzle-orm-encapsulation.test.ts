/**
 * Unit tests for drizzle-orm-encapsulation rule
 * CRITICAL: No direct Drizzle ORM imports outside lib/vendor/Drizzle/
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let drizzleOrmEncapsulationRule: typeof import('./drizzle-orm-encapsulation').drizzleOrmEncapsulationRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./drizzle-orm-encapsulation')
  drizzleOrmEncapsulationRule = module.drizzleOrmEncapsulationRule
})

describe('drizzle-orm-encapsulation rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(drizzleOrmEncapsulationRule.name).toBe('drizzle-orm-encapsulation')
    })

    test('should have CRITICAL severity', () => {
      expect(drizzleOrmEncapsulationRule.severity).toBe('CRITICAL')
    })

    test('should apply to src/**/*.ts files', () => {
      expect(drizzleOrmEncapsulationRule.appliesTo).toContain('src/**/*.ts')
    })

    test('should exclude vendor files', () => {
      expect(drizzleOrmEncapsulationRule.excludes).toContain('src/lib/vendor/Drizzle/**/*.ts')
    })
  })

  describe('detects direct Drizzle ORM imports', () => {
    test('should detect drizzle-orm import', () => {
      const sourceFile = project.createSourceFile('test-drizzle.ts', "import {eq} from 'drizzle-orm'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('CRITICAL')
      expect(violations[0].message).toContain('drizzle-orm')
    })

    test('should detect drizzle-orm type import', () => {
      const sourceFile = project.createSourceFile('test-drizzle-type.ts', "import type {InferSelectModel} from 'drizzle-orm'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('drizzle-orm')
    })

    test('should detect drizzle-orm/pg-core import', () => {
      const sourceFile = project.createSourceFile('test-pg-core.ts', "import {pgTable, text} from 'drizzle-orm/pg-core'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('drizzle-orm/pg-core')
    })

    test('should detect drizzle-orm/postgres-js import', () => {
      const sourceFile = project.createSourceFile('test-postgres-js.ts', "import {drizzle} from 'drizzle-orm/postgres-js'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('drizzle-orm/postgres-js')
    })

    test('should detect postgres driver import', () => {
      const sourceFile = project.createSourceFile('test-postgres.ts', "import postgres from 'postgres'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('postgres')
    })

    test('should detect multiple Drizzle imports', () => {
      const sourceFile = project.createSourceFile('test-multiple.ts', `import {eq, and} from 'drizzle-orm'
import type {InferSelectModel} from 'drizzle-orm'`, {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(2)
    })
  })

  describe('detects dynamic Drizzle imports', () => {
    test('should detect dynamic import of drizzle-orm', () => {
      const sourceFile = project.createSourceFile('test-dynamic.ts', "const drizzle = await import('drizzle-orm')", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('Dynamic Drizzle ORM import forbidden')
    })
  })

  describe('allows valid patterns', () => {
    test('should allow vendor wrapper imports', () => {
      const sourceFile = project.createSourceFile('test-vendor.ts', `import {getDrizzleClient} from '#lib/vendor/Drizzle/client'
import {eq, and} from '#lib/vendor/Drizzle/types'
import {users} from '#lib/vendor/Drizzle/schema'`, {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow other package imports', () => {
      const sourceFile = project.createSourceFile('test-other.ts', `import {v4 as uuidv4} from 'uuid'
import {APIGatewayProxyEvent} from 'aws-lambda'`, {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow entity query imports', () => {
      const sourceFile = project.createSourceFile('test-entities.ts', `import {getUser} from '#entities/queries/user-queries'
import {getFile} from '#entities/queries/file-queries'`, {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('skips vendor files', () => {
    test('should skip files in lib/vendor/Drizzle/', () => {
      const sourceFile = project.createSourceFile('test-vendor-internal.ts', "import {eq} from 'drizzle-orm'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lib/vendor/Drizzle/types.ts')

      expect(violations).toHaveLength(0)
    })

    test('should skip files in lib/vendor/Drizzle subdirectories', () => {
      const sourceFile = project.createSourceFile('test-vendor-sub.ts', "import {drizzle} from 'drizzle-orm/postgres-js'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lib/vendor/Drizzle/client.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest Drizzle types vendor wrapper', () => {
      const sourceFile = project.createSourceFile('test-suggestion-types.ts', "import {eq} from 'drizzle-orm'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toContain('lib/vendor/Drizzle/types')
    })

    test('should suggest Drizzle schema vendor wrapper', () => {
      const sourceFile = project.createSourceFile('test-suggestion-schema.ts', "import {pgTable} from 'drizzle-orm/pg-core'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toContain('lib/vendor/Drizzle/schema')
    })

    test('should suggest Drizzle client vendor wrapper for postgres-js', () => {
      const sourceFile = project.createSourceFile('test-suggestion-client.ts', "import {drizzle} from 'drizzle-orm/postgres-js'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toContain('lib/vendor/Drizzle/client')
    })
  })

  describe('includes code context', () => {
    test('should include code snippet in violation', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', "import {eq} from 'drizzle-orm'", {overwrite: true})

      const violations = drizzleOrmEncapsulationRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].codeSnippet).toBeDefined()
      expect(violations[0].codeSnippet).toContain('drizzle-orm')
    })
  })
})
