/**
 * Jest configuration for running ALL tests (unit + integration)
 * with merged coverage reporting
 *
 * This configuration runs both test suites and generates a single
 * comprehensive coverage report that includes:
 * - Application logic coverage from unit tests
 * - Vendor wrapper coverage from integration tests
 *
 * Usage: npm run test:all
 */

const config = {
  // Run both unit and integration tests as separate projects
  projects: [
    '<rootDir>/config/jest.config.mjs',           // Unit tests
    '<rootDir>/config/jest.integration.config.mjs' // Integration tests
  ],

  // Collect coverage from both projects
  collectCoverage: true,

  // Merge coverage into single directory
  coverageDirectory: 'coverage',

  // Coverage provider
  coverageProvider: 'v8',

  // Coverage reporters
  coverageReporters: [
    'text',        // Console output
    'text-summary', // Summary in console
    'html',        // HTML report in coverage/
    'lcov'         // For CI/CD tools
  ],

  // Optional: Set coverage thresholds
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80
  //   }
  // }
}

export default config
