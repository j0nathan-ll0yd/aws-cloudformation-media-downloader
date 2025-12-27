/**
 * Tests for use-entity-mock-helper ESLint rule
 */

const {RuleTester} = require('eslint')
const rule = require('../rules/use-entity-mock-helper.cjs')

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
})

ruleTester.run('use-entity-mock-helper', rule, {
  valid: [
    // Allowed: Using createEntityMock in test file
    {
      code: `jest.unstable_mockModule('#entities/Users', () => createEntityMock({
        queryIndexes: ['byEmail']
      }))`,
      filename: 'src/lambdas/LoginUser/test/index.test.ts'
    },
    // Allowed: Using legacy createElectroDBEntityMock in test file
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
    // Allowed: entity-mock helper file itself
    {
      code: `export function createEntityMock(config) {
        return { entity: mockEntity, mockFunctions: {} }
      }`,
      filename: 'test/helpers/entity-mock.ts'
    },
    // Allowed: Mock uses createEntityMock (jest.mock)
    {
      code: `jest.mock('#entities/Files', () => createEntityMock({
        queryIndexes: ['byStatus']
      }))`,
      filename: 'src/lambdas/FileCoordinator/test/index.test.ts'
    },
    // Allowed: Variable assigned from createEntityMock, then .entity used
    {
      code: `const userFilesMock = createEntityMock({queryIndexes: ['byUser']})
const filesMock = createEntityMock()
jest.unstable_mockModule('#entities/UserFiles', () => ({UserFiles: userFilesMock.entity}))
jest.unstable_mockModule('#entities/Files', () => ({Files: filesMock.entity}))`,
      filename: 'src/lambdas/ListFiles/test/index.test.ts'
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

console.log('use-entity-mock-helper: All tests passed!')
