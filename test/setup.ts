/**
 * Vitest Global Test Setup
 *
 * Configures the test environment for all unit tests.
 * This file runs before all tests via setupFiles in vitest.config.mts
 */

// Default to silent logging during tests to reduce noise
// Can be overridden with LOG_LEVEL=DEBUG pnpm test
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'SILENT'
