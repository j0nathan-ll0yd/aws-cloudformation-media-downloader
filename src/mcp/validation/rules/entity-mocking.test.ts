/**
 * Unit tests for entity-mocking rule
 * CRITICAL: Detect legacy entity mocking patterns (deprecated)
 *
 * With Drizzle query functions, tests should mock #entities/queries directly
 * using vi.fn() for each function. Legacy entity module mocks are deprecated.
 * This is CRITICAL because incorrect mocking causes test failures when entity layer changes.
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let entityMockingRule: typeof import('./entity-mocking').entityMockingRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./entity-mocking')
  entityMockingRule = module.entityMockingRule
})

describe('entity-mocking rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(entityMockingRule.name).toBe('entity-mocking')
    })

    test('should have CRITICAL severity', () => {
      expect(entityMockingRule.severity).toBe('CRITICAL')
    })

    test('should apply to test files', () => {
      expect(entityMockingRule.appliesTo).toContain('src/**/*.test.ts')
      expect(entityMockingRule.appliesTo).toContain('test/**/*.ts')
    })

    test('should exclude helper files', () => {
      expect(entityMockingRule.excludes).toContain('test/helpers/**/*.ts')
    })
  })

  describe('skips non-test files', () => {
    test('should skip files not in test directories', () => {
      const sourceFile = project.createSourceFile('test-non-test.ts', `import {Users} from '#entities/Users'
vi.mock('#entities/Users', () => ({
  Users: { get: vi.fn() }
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should skip helper files', () => {
      const sourceFile = project.createSourceFile('test-helper.ts', `import {Users} from '#entities/Users'
vi.mock('#entities/Users', () => ({
  Users: { get: vi.fn() }
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'test/helpers/entity-mock.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('detects legacy entity mocking patterns', () => {
    test('should detect vi.mock with legacy entity path', () => {
      const sourceFile = project.createSourceFile('test-mock-users.ts', `import {beforeAll, describe, test} from 'vitest'

vi.mock('#entities/Users', () => ({
  Users: {
    get: vi.fn(),
    create: vi.fn()
  }
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('CRITICAL')
      expect(violations[0].message).toContain('#entities/Users')
      expect(violations[0].message).toContain('#entities/queries')
    })

    test('should detect jest.mock with legacy entity path', () => {
      const sourceFile = project.createSourceFile('test-mock-files.ts', `import {beforeAll, describe, test} from 'vitest'

jest.mock('#entities/Files', () => ({
  Files: {
    get: vi.fn(),
    put: vi.fn()
  }
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('#entities/Files')
    })

    test('should detect mocking of legacy UserFiles entity', () => {
      const sourceFile = project.createSourceFile('test-mock-userfiles.ts', `vi.mock('#entities/UserFiles', () => ({
  UserFiles: { query: vi.fn() }
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'test/integration/user.test.ts')

      expect(violations).toHaveLength(1)
    })

    test('should detect mocking of legacy Devices entity', () => {
      const sourceFile = project.createSourceFile('test-mock-devices.ts', `vi.mock('#entities/Devices', () => ({
  Devices: { scan: vi.fn() }
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'test/unit/devices.test.ts')

      expect(violations).toHaveLength(1)
    })

    test('should detect deprecated createEntityMock usage', () => {
      const sourceFile = project.createSourceFile('test-create-entity-mock.ts', `import {createEntityMock} from '../../../../test/helpers/entity-mock'

vi.mock('#entities/Users', () => ({
  Users: createEntityMock({queryIndexes: ['byEmail']})
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      // Expect 2 violations: legacy path + createEntityMock usage
      expect(violations).toHaveLength(2)
      const createEntityMockViolation = violations.find((v) => v.message.includes('createEntityMock'))
      expect(createEntityMockViolation).toBeDefined()
      expect(createEntityMockViolation!.message).toContain('deprecated')
    })
  })

  describe('allows correct mocking patterns', () => {
    test('should allow native Drizzle query mocking', () => {
      const sourceFile = project.createSourceFile('test-drizzle-mock.ts', `import {describe, test, vi} from 'vitest'

vi.mock('#entities/queries', () => ({
  getUser: vi.fn(),
  createUser: vi.fn(),
  getUsersByEmail: vi.fn(),
  deleteUser: vi.fn()
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow test files without entity imports', () => {
      const sourceFile = project.createSourceFile('test-no-entities.ts', `import {describe, expect, test} from 'vitest'

describe('utility function', () => {
  test('should work', () => {
    expect(true).toBe(true)
  })
})`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/util/test/helpers.test.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow non-entity mocks', () => {
      const sourceFile = project.createSourceFile('test-other-mocks.ts', `import {describe, test} from 'vitest'

vi.mock('#lib/vendor/AWS/S3', () => ({
  uploadToS3: vi.fn()
}))

vi.mock('#util/lambda-helpers', () => ({
  response: vi.fn()
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow vi.mock with #entities/queries path', () => {
      const sourceFile = project.createSourceFile('test-queries-mock.ts', `import {describe, test, vi} from 'vitest'

vi.mock('#entities/queries', () => ({
  getFile: vi.fn(),
  createFile: vi.fn(),
  getDevice: vi.fn(),
  getUserFilesByUserId: vi.fn()
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('detects legacy entity patterns', () => {
    test('should warn when mocking legacy entity modules', () => {
      const sourceFile = project.createSourceFile('test-missing-import.ts', `import {describe, test} from 'vitest'

// File uses legacy entity mock pattern
const mockUsers = {
  get: vi.fn()
}

vi.mock('#entities/Users', () => ({
  Users: mockUsers
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].suggestion).toContain('#entities/queries')
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest using #entities/queries', () => {
      const sourceFile = project.createSourceFile('test-suggestion.ts', `vi.mock('#entities/Users', () => ({
  Users: { get: vi.fn() }
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations[0].suggestion).toBeDefined()
      expect(violations[0].suggestion).toContain('#entities/queries')
    })

    test('should include code snippet', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', `vi.mock('#entities/Files', () => ({
  Files: { query: vi.fn() }
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'test/lambdas/files.test.ts')

      expect(violations[0].codeSnippet).toBeDefined()
      expect(violations[0].codeSnippet).toContain('#entities/Files')
    })
  })

  describe('handles multiple legacy entities', () => {
    test('should detect multiple legacy entity mocks', () => {
      const sourceFile = project.createSourceFile('test-multiple-entities.ts', `vi.mock('#entities/Users', () => ({
  Users: { get: vi.fn() }
}))

vi.mock('#entities/Files', () => ({
  Files: { query: vi.fn() }
}))

vi.mock('#entities/Devices', () => ({
  Devices: { scan: vi.fn() }
}))`, {overwrite: true})

      const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('all known legacy entities', () => {
    const entities = ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices', 'Sessions', 'Accounts', 'Verifications']

    entities.forEach((entity) => {
      test(`should detect legacy mock of ${entity}`, () => {
        const sourceFile = project.createSourceFile(`test-${entity.toLowerCase()}.ts`, `vi.mock('#entities/${entity}', () => ({
  ${entity}: { get: vi.fn() }
}))`, {overwrite: true})

        const violations = entityMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain(entity)
      })
    })
  })
})
