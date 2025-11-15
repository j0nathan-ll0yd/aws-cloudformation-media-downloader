/**
 * Jest configuration for integration tests
 * These tests run against LocalStack to test AWS service integrations
 */

const config = {
  clearMocks: true,
  collectCoverage: false, // Disable coverage for integration tests
  coverageProvider: 'v8',
  extensionsToTreatAsEsm: ['.ts'],
  preset: 'ts-jest',
  rootDir: '../',
  testEnvironment: 'node',
  testMatch: ['**/*.integration.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testTimeout: 30000, // LocalStack can be slower than unit tests
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        useESM: true
      }
    ]
  }
}

export default config
