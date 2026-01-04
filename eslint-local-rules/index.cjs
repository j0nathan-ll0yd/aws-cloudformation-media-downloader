/**
 * ESLint Local Rules Plugin
 * Project-specific ESLint rules for in-editor convention enforcement
 *
 * These rules mirror MCP validation rules to provide immediate feedback in the editor.
 *
 * Phase 1 (CRITICAL):
 *   - no-direct-aws-sdk-import: Block direct AWS SDK imports
 *   - cascade-delete-order: Detect Promise.all with deletes
 *   - use-entity-mock-helper: Enforce mock helper usage
 *
 * Phase 2 (HIGH):
 *   - response-helpers: Enforce response() helper usage
 *   - env-validation: Enforce getRequiredEnv() usage
 *   - authenticated-handler-enforcement: Enforce centralized auth wrappers
 *
 * Phase 3 (STRATEGIC):
 *   - enforce-powertools: Enforce PowerTools wrapper usage
 *   - no-domain-leakage: Prevent domain from importing outer layers
 *   - strict-env-vars: Forbid direct process.env in handlers
 */

const noDirectAwsSdkImport = require('./rules/no-direct-aws-sdk-import.cjs')
const cascadeDeleteOrder = require('./rules/cascade-delete-order.cjs')
const useEntityMockHelper = require('./rules/use-entity-mock-helper.cjs')
const migrationsSafety = require('./rules/migrations-safety.cjs')
const responseHelpers = require('./rules/response-helpers.cjs')
const envValidation = require('./rules/env-validation.cjs')
const authenticatedHandlerEnforcement = require('./rules/authenticated-handler-enforcement.cjs')
const enforcePowertools = require('./rules/enforce-powertools.cjs')
const noDomainLeakage = require('./rules/no-domain-leakage.cjs')
const strictEnvVars = require('./rules/strict-env-vars.cjs')
const spacingConventions = require('./rules/spacing-conventions.cjs')
const importOrder = require('./rules/import-order.cjs')

module.exports = {
  rules: {
    // Phase 1: CRITICAL
    'no-direct-aws-sdk-import': noDirectAwsSdkImport,
    'cascade-delete-order': cascadeDeleteOrder,
    'use-entity-mock-helper': useEntityMockHelper,
    'migrations-safety': migrationsSafety,
    // Phase 2: HIGH
    'response-helpers': responseHelpers,
    'env-validation': envValidation,
    'authenticated-handler-enforcement': authenticatedHandlerEnforcement,
    // Phase 3: STRATEGIC
    'enforce-powertools': enforcePowertools,
    'no-domain-leakage': noDomainLeakage,
    'strict-env-vars': strictEnvVars,
    // Phase 4: STYLISTIC (comment conventions)
    'spacing-conventions': spacingConventions,
    'import-order': importOrder
  }
}
