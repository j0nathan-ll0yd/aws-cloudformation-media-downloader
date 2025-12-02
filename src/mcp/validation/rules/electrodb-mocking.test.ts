/**
 * Unit tests for electrodb-mocking rule
 * CRITICAL: Test files must use createElectroDBEntityMock() helper
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let electrodbMockingRule: typeof import('./electrodb-mocking').electrodbMockingRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./electrodb-mocking')
  electrodbMockingRule = module.electrodbMockingRule
})

describe('electrodb-mocking rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(electrodbMockingRule.name).toBe('electrodb-mocking')
    })

    test('should have CRITICAL severity', () => {
      expect(electrodbMockingRule.severity).toBe('CRITICAL')
    })

    test('should apply to test files', () => {
      expect(electrodbMockingRule.appliesTo).toContain('src/**/*.test.ts')
      expect(electrodbMockingRule.appliesTo).toContain('test/**/*.ts')
    })

    test('should exclude helper files', () => {
      expect(electrodbMockingRule.excludes).toContain('test/helpers/**/*.ts')
    })
  })

  describe('skips non-test files', () => {
    test('should skip files not in test directories', () => {
      const sourceFile = project.createSourceFile('test-non-test.ts', `import {Users} from '#entities/Users'
jest.unstable_mockModule('#entities/Users', () => ({
  Users: { get: jest.fn() }
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should skip helper files', () => {
      const sourceFile = project.createSourceFile('test-helper.ts', `import {Users} from '#entities/Users'
jest.unstable_mockModule('#entities/Users', () => ({
  Users: { get: jest.fn() }
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'test/helpers/electrodb-mock.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('detects manual entity mocking', () => {
    test('should detect jest.unstable_mockModule without helper', () => {
      const sourceFile = project.createSourceFile('test-mock-users.ts', `import {beforeAll, describe, test} from '@jest/globals'
import {Users} from '#entities/Users'

jest.unstable_mockModule('#entities/Users', () => ({
  Users: {
    get: jest.fn(),
    create: jest.fn()
  }
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('CRITICAL')
      expect(violations[0].message).toContain('#entities/Users')
      expect(violations[0].message).toContain('createElectroDBEntityMock')
    })

    test('should detect jest.mock without helper', () => {
      const sourceFile = project.createSourceFile('test-mock-files.ts', `import {beforeAll, describe, test} from '@jest/globals'
import {Files} from '#entities/Files'

jest.mock('#entities/Files', () => ({
  Files: {
    get: jest.fn(),
    put: jest.fn()
  }
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('#entities/Files')
    })

    test('should detect mocking of UserFiles entity', () => {
      const sourceFile = project.createSourceFile('test-mock-userfiles.ts', `jest.unstable_mockModule('#entities/UserFiles', () => ({
  UserFiles: { query: jest.fn() }
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'test/integration/user.test.ts')

      expect(violations).toHaveLength(1)
    })

    test('should detect mocking of Devices entity', () => {
      const sourceFile = project.createSourceFile('test-mock-devices.ts', `jest.unstable_mockModule('#entities/Devices', () => ({
  Devices: { scan: jest.fn() }
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'test/unit/devices.test.ts')

      expect(violations).toHaveLength(1)
    })
  })

  describe('allows correct mocking patterns', () => {
    test('should allow createElectroDBEntityMock usage', () => {
      const sourceFile = project.createSourceFile('test-correct-mock.ts', `import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'
import {Users} from '#entities/Users'

const UsersMock = createElectroDBEntityMock({
  get: jest.fn(),
  create: jest.fn()
})

jest.unstable_mockModule('#entities/Users', () => ({
  Users: createElectroDBEntityMock({get: jest.fn()})
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow test files without entity imports', () => {
      const sourceFile = project.createSourceFile('test-no-entities.ts', `import {describe, expect, test} from '@jest/globals'

describe('utility function', () => {
  test('should work', () => {
    expect(true).toBe(true)
  })
})`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'src/util/test/helpers.test.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow non-entity mocks', () => {
      const sourceFile = project.createSourceFile('test-other-mocks.ts', `import {describe, test} from '@jest/globals'

jest.unstable_mockModule('#lib/vendor/AWS/S3', () => ({
  uploadToS3: jest.fn()
}))

jest.unstable_mockModule('#util/lambda-helpers', () => ({
  response: jest.fn()
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('detects entity usage without helper import', () => {
    test('should warn when mocking entities without helper', () => {
      const sourceFile = project.createSourceFile('test-missing-import.ts', `import {describe, test} from '@jest/globals'

// File references entities but doesn't use helper
const mockUsers = {
  get: jest.fn()
}

jest.unstable_mockModule('#entities/Users', () => ({
  Users: mockUsers
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].suggestion).toContain('createElectroDBEntityMock')
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest proper import path', () => {
      const sourceFile = project.createSourceFile('test-suggestion.ts', `jest.unstable_mockModule('#entities/Users', () => ({
  Users: { get: jest.fn() }
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations[0].suggestion).toBeDefined()
      expect(violations[0].suggestion).toContain('createElectroDBEntityMock')
    })

    test('should include code snippet', () => {
      const sourceFile = project.createSourceFile('test-snippet.ts', `jest.unstable_mockModule('#entities/Files', () => ({
  Files: { query: jest.fn() }
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'test/lambdas/files.test.ts')

      expect(violations[0].codeSnippet).toBeDefined()
      expect(violations[0].codeSnippet).toContain('#entities/Files')
    })
  })

  describe('handles multiple entities', () => {
    test('should detect multiple manual entity mocks', () => {
      const sourceFile = project.createSourceFile('test-multiple-entities.ts', `jest.unstable_mockModule('#entities/Users', () => ({
  Users: { get: jest.fn() }
}))

jest.unstable_mockModule('#entities/Files', () => ({
  Files: { query: jest.fn() }
}))

jest.unstable_mockModule('#entities/Devices', () => ({
  Devices: { scan: jest.fn() }
}))`, {overwrite: true})

      const violations = electrodbMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

      expect(violations.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('all known entities', () => {
    const entities = ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices', 'Sessions', 'Accounts', 'Verifications']

    entities.forEach((entity) => {
      test(`should detect manual mock of ${entity}`, () => {
        const sourceFile = project.createSourceFile(`test-${entity.toLowerCase()}.ts`, `jest.unstable_mockModule('#entities/${entity}', () => ({
  ${entity}: { get: jest.fn() }
}))`, {overwrite: true})

        const violations = electrodbMockingRule.validate(sourceFile, 'src/lambdas/Test/test/index.test.ts')

        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain(entity)
      })
    })
  })
})
