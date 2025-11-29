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

  // Coverage and timeout options are configured in jest.all.config.mjs when running multi-project tests
  // For standalone runs, use: npm run test:integration -- --coverage

  // Treat .ts files as ES modules
  extensionsToTreatAsEsm: ['.ts'],

  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Root directory for Jest
  rootDir: '../',

  // Use Node environment for Lambda-like execution
  testEnvironment: 'node',

  // Force Jest to exit after all tests complete
  // Required because AWS SDK maintains internal connections that don't properly clean up
  forceExit: true,

  // Only match integration test files
  testMatch: ['**/test/integration/**/*.integration.test.ts'],

  // Ignore node_modules and build artifacts
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],

  // Transform TypeScript files with ts-jest
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.test.json'
      }
    ]
  },

  // Setup file to configure LocalStack environment
  setupFilesAfterEnv: ['<rootDir>/test/integration/setup.ts']
}

export default config
