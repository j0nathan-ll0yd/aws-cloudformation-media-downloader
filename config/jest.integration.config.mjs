/**
 * Jest configuration for integration tests
 *
 * Integration tests run against LocalStack to verify AWS service interactions
 * without mocking. These tests validate that vendor wrappers work correctly
 * with real AWS SDK clients in a LocalStack environment.
 */

const config = {
  // Automatically clear mock calls between tests
  clearMocks: true,

  // Enable coverage collection for integration tests
  // Coverage will be merged with unit test coverage when using jest.all.config.mjs
  collectCoverage: true,

  // Write coverage to same directory as unit tests for merging
  coverageDirectory: 'coverage',

  // Treat .ts files as ES modules
  extensionsToTreatAsEsm: ['.ts'],

  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Root directory for Jest
  rootDir: '../',

  // Use Node environment for Lambda-like execution
  testEnvironment: 'node',

  // Only match integration test files
  testMatch: ['**/test/integration/**/*.integration.test.ts'],

  // Ignore node_modules and build artifacts
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],

  // Longer timeout for integration tests (LocalStack operations can be slower)
  testTimeout: 30000,

  // Transform TypeScript files with ts-jest
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        useESM: true
      }
    ]
  },

  // Setup file to configure LocalStack environment
  setupFilesAfterEnv: ['<rootDir>/test/integration/setup.ts']
}

export default config
