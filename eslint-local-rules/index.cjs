/**
 * ESLint Local Rules Plugin
 * Project-specific ESLint rules for in-editor convention enforcement
 *
 * These rules mirror MCP validation rules to provide immediate feedback in the editor.
 */

const noDirectAwsSdkImport = require('./rules/no-direct-aws-sdk-import.cjs')
const cascadeDeleteOrder = require('./rules/cascade-delete-order.cjs')
const useElectrodbMockHelper = require('./rules/use-electrodb-mock-helper.cjs')

module.exports = {
  rules: {
    'no-direct-aws-sdk-import': noDirectAwsSdkImport,
    'cascade-delete-order': cascadeDeleteOrder,
    'use-electrodb-mock-helper': useElectrodbMockHelper
  }
}
