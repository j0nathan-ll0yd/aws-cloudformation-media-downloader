/**
 * Jest configuration for integration tests
 *
 * Integration tests run against LocalStack to verify AWS service interactions
 * without mocking. These tests validate that vendor wrappers work correctly
 * with real AWS SDK clients in a LocalStack environment.
 */

// Default to silent logging during tests to reduce noise
// Can be overridden with LOG_LEVEL=DEBUG pnpm test
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'SILENT'

const config = {
  // Automatically clear mock calls between tests
  clearMocks: true,

  // Module path aliases for # imports
  moduleNameMapper: {
    '^#entities/(.*)$': '<rootDir>/src/entities/$1',
    '^#lib/(.*)$': '<rootDir>/src/lib/$1',
    '^#util/(.*)$': '<rootDir>/src/util/$1',
    '^#types/(.*)$': '<rootDir>/src/types/$1',
    '^#test/(.*)$': '<rootDir>/test/$1'
  },

  // Coverage and timeout options are configured in jest.all.config.mjs when running multi-project tests
  // For standalone runs, use: npm run test:integration -- --coverage

  // Treat .ts files as ES modules
  extensionsToTreatAsEsm: ['.ts'],

  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Limit workers to prevent Jest worker hang issues with AWS SDK
  maxWorkers: 2,

  // Root directory for Jest
  rootDir: '../',

  // Use Node environment for Lambda-like execution
  testEnvironment: 'node',

  // Only match integration test files
  testMatch: ['**/test/integration/**/*.integration.test.ts'],

  // Ignore node_modules and build artifacts
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],

  // Transform TypeScript files with ts-jest
  transform: {'^.+\\.[tj]sx?$': ['ts-jest', {useESM: true, tsconfig: '<rootDir>/tsconfig.test.json'}]},

  // Setup file to configure LocalStack environment
  setupFilesAfterEnv: ['<rootDir>/test/integration/setup.ts']
}

export default config
