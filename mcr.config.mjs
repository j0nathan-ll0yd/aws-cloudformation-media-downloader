/**
 * Monocart Coverage Reports Configuration
 * @see https://github.com/cenfun/monocart-coverage-reports
 */
export default {
  name: 'Unit Test Coverage',

  // Only show errors, suppress info messages
  logging: 'error',

  // Filter coverage entries BEFORE source lookup (prevents "Not found source data" warnings)
  // V8 coverage captures ALL executed code, but we only want production source files
  entryFilter: (entry) => {
    const url = entry.url || ''
    // Exclude test files, fixtures, setup files, and JSON
    if (url.includes('/test/')) {
      return false
    }
    if (url.includes('.test.ts')) {
      return false
    }
    if (url.includes('setup.ts')) {
      return false
    }
    if (url.endsWith('.json')) {
      return false
    }
    // Exclude MCP code (already excluded in vitest config)
    if (url.includes('/mcp/')) {
      return false
    }
    return true
  },

  // Filter source paths in the final report
  sourceFilter: (sourcePath) => {
    if (sourcePath.endsWith('.json')) {
      return false
    }
    if (sourcePath.includes('/test/')) {
      return false
    }
    return true
  }
}
