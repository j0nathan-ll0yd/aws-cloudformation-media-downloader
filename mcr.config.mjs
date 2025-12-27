/**
 * Monocart Coverage Reports Configuration
 * @see https://github.com/cenfun/monocart-coverage-reports
 */
export default {
  name: 'Unit Test Coverage',

  // Only show errors, suppress warnings about missing JSON source content
  logging: 'error',

  // Filter out non-TypeScript files from source mapping
  sourceFilter: (sourcePath) => {
    // Exclude JSON fixtures from source content lookups
    if (sourcePath.endsWith('.json')) {
      return false
    }
    // Exclude test files from coverage source
    if (sourcePath.includes('/test/')) {
      return false
    }
    return true
  }
}
