/**
 * Tests for use-electrodb-mock-helper ESLint rule
 */

const {RuleTester} = require('eslint')
const rule = require('../rules/use-electrodb-mock-helper.cjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
})

ruleTester.run('use-electrodb-mock-helper', rule, {
  valid: [
    // Allowed: Using createElectroDBEntityMock in test file
    {
      code: `jest.unstable_mockModule('#entities/Users', () => createElectroDBEntityMock({
        queryIndexes: ['byEmail']
      }))`,
      filename: 'src/lambdas/LoginUser/test/index.test.ts'
    },
    // Allowed: Non-entity mock in test file
    {
      code: `jest.unstable_mockModule('#lib/vendor/AWS/S3', () => ({
        uploadFile: jest.fn()
      }))`,
      filename: 'src/lambdas/StartFileUpload/test/index.test.ts'
    },
    // Allowed: Non-test file (rule doesn't apply)
    {
      code: `jest.mock('#entities/Users', () => ({
        Users: { get: jest.fn() }
      }))`,
      filename: 'src/lambdas/ListFiles/src/index.ts'
    },
    // Allowed: electrodb-mock helper file itself
    {
      code: `export function createElectroDBEntityMock(config) {
        return { entity: mockEntity, mockFunctions: {} }
      }`,
      filename: 'test/helpers/electrodb-mock.ts'
    },
    // Allowed: Mock uses createElectroDBEntityMock (jest.mock)
    {
      code: `jest.mock('#entities/Files', () => createElectroDBEntityMock({
        queryIndexes: ['byStatus']
      }))`,
      filename: 'src/lambdas/FileCoordinator/test/index.test.ts'
    }
  ],
  invalid: [
    // Forbidden: Manual entity mock in test file
    {
      code: `jest.unstable_mockModule('#entities/Users', () => ({
        Users: {
          get: jest.fn(),
          query: { byEmail: jest.fn() }
        }
      }))`,
      filename: 'src/lambdas/LoginUser/test/index.test.ts',
      errors: [{messageId: 'manualMock'}]
    },
    // Forbidden: Manual mock for Files entity
    {
      code: `jest.unstable_mockModule('#entities/Files', () => ({
        Files: { create: jest.fn(), get: jest.fn() }
      }))`,
      filename: 'src/lambdas/ListFiles/test/index.test.ts',
      errors: [{messageId: 'manualMock'}]
    },
    // Forbidden: jest.mock with manual entity mock
    {
      code: `jest.mock('#entities/Devices', () => ({
        Devices: { get: jest.fn() }
      }))`,
      filename: 'src/lambdas/RegisterDevice/test/index.test.ts',
      errors: [{messageId: 'manualMock'}]
    },
    // Forbidden: Mocking UserFiles without helper
    {
      code: `jest.unstable_mockModule('#entities/UserFiles', () => ({
        UserFiles: { query: { byUser: jest.fn() } }
      }))`,
      filename: 'test/integration/user-files.test.ts',
      errors: [{messageId: 'manualMock'}]
    }
  ]
})

console.log('use-electrodb-mock-helper: All tests passed!')
