/**
 * Shared validation core for MCP convention checking
 * Exports all validation rules and provides a unified validation interface
 *
 * This module can be consumed by:
 * - MCP validate_pattern tool
 * - CI validation scripts
 * - Future tooling
 */

import {Project} from 'ts-morph'
import type {SourceFile} from 'ts-morph'
import * as path from 'node:path'
import type {ValidationResult, ValidationRule, Violation} from './types'
import {awsSdkEncapsulationRule} from './rules/aws-sdk-encapsulation'
import {drizzleOrmEncapsulationRule} from './rules/drizzle-orm-encapsulation'
import {entityMockingRule} from './rules/entity-mocking'
import {importOrderRule} from './rules/import-order'
import {responseHelpersRule} from './rules/response-helpers'
import {configEnforcementRule} from './rules/config-enforcement'
import {typesLocationRule} from './rules/types-location'
import {envValidationRule} from './rules/env-validation'
import {cascadeSafetyRule} from './rules/cascade-safety'
import {batchRetryRule} from './rules/batch-retry'
import {scanPaginationRule} from './rules/scan-pagination'
import {responseEnumRule} from './rules/response-enum'
import {mockFormattingRule} from './rules/mock-formatting'
import {docSyncRule} from './rules/doc-sync'
import {namingConventionsRule} from './rules/naming-conventions'
import {authenticatedHandlerEnforcementRule} from './rules/authenticated-handler-enforcement'
import {commentConventionsRule} from './rules/comment-conventions'
import {docsStructureRule} from './rules/docs-structure'
import {powertoolsMetricsRule} from './rules/powertools-metrics'
import {migrationsSafetyRule} from './rules/migrations-safety'

// Export all rules (20 total: 7 CRITICAL + 9 HIGH + 4 MEDIUM)
export const allRules: ValidationRule[] = [
  // CRITICAL
  awsSdkEncapsulationRule,
  drizzleOrmEncapsulationRule,
  entityMockingRule,
  configEnforcementRule,
  envValidationRule,
  cascadeSafetyRule,
  migrationsSafetyRule,
  // HIGH
  responseHelpersRule,
  typesLocationRule,
  batchRetryRule,
  scanPaginationRule,
  // MEDIUM
  importOrderRule,
  responseEnumRule,
  mockFormattingRule,
  // HIGH (documentation)
  docSyncRule,
  commentConventionsRule,
  // HIGH (naming)
  namingConventionsRule,
  // HIGH (auth)
  authenticatedHandlerEnforcementRule,
  // HIGH (docs structure)
  docsStructureRule,
  // MEDIUM (observability)
  powertoolsMetricsRule
]

// Export rules by name for selective validation
export const rulesByName: Record<string, ValidationRule> = {
  // CRITICAL rules
  'aws-sdk-encapsulation': awsSdkEncapsulationRule,
  'aws-sdk': awsSdkEncapsulationRule, // alias
  'drizzle-orm-encapsulation': drizzleOrmEncapsulationRule,
  drizzle: drizzleOrmEncapsulationRule, // alias
  'drizzle-orm': drizzleOrmEncapsulationRule, // alias
  'entity-mocking': entityMockingRule,
  entity: entityMockingRule, // alias
  'config-enforcement': configEnforcementRule,
  config: configEnforcementRule, // alias
  'env-validation': envValidationRule,
  env: envValidationRule, // alias
  'cascade-safety': cascadeSafetyRule,
  cascade: cascadeSafetyRule, // alias
  'migrations-safety': migrationsSafetyRule,
  migrations: migrationsSafetyRule, // alias
  // HIGH rules
  'response-helpers': responseHelpersRule,
  response: responseHelpersRule, // alias
  'types-location': typesLocationRule,
  types: typesLocationRule, // alias
  'batch-retry': batchRetryRule,
  batch: batchRetryRule, // alias
  'scan-pagination': scanPaginationRule,
  scan: scanPaginationRule, // alias
  // MEDIUM rules
  'import-order': importOrderRule,
  imports: importOrderRule, // alias
  'response-enum': responseEnumRule,
  enum: responseEnumRule, // alias
  'mock-formatting': mockFormattingRule,
  mock: mockFormattingRule, // alias
  // HIGH (documentation) rules
  'doc-sync': docSyncRule,
  docs: docSyncRule, // alias
  'comment-conventions': commentConventionsRule,
  comments: commentConventionsRule, // alias
  // HIGH (naming) rules
  'naming-conventions': namingConventionsRule,
  naming: namingConventionsRule, // alias
  // HIGH (auth) rules
  'authenticated-handler-enforcement': authenticatedHandlerEnforcementRule,
  auth: authenticatedHandlerEnforcementRule, // alias
  // HIGH (docs structure) rules
  'docs-structure': docsStructureRule,
  'docs-location': docsStructureRule, // alias
  // MEDIUM (observability) rules
  'powertools-metrics': powertoolsMetricsRule,
  metrics: powertoolsMetricsRule // alias
}

// Export individual rules
export {
  authenticatedHandlerEnforcementRule,
  awsSdkEncapsulationRule,
  batchRetryRule,
  cascadeSafetyRule,
  commentConventionsRule,
  configEnforcementRule,
  docsStructureRule,
  docSyncRule,
  drizzleOrmEncapsulationRule,
  entityMockingRule,
  envValidationRule,
  importOrderRule,
  migrationsSafetyRule,
  mockFormattingRule,
  namingConventionsRule,
  powertoolsMetricsRule,
  responseEnumRule,
  responseHelpersRule,
  scanPaginationRule,
  typesLocationRule
}

// Export types
export * from './types'

/**
 * Check if a file path matches a glob-like pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Simple glob matching: ** matches any path segment, * matches within segment
  const regexPattern = pattern.replace(/\*\*/g, '{{DOUBLE_STAR}}').replace(/\*/g, '[^/]*').replace(/{{DOUBLE_STAR}}/g, '.*').replace(/\//g, '\\/')
  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(filePath)
}

/**
 * Check if a rule applies to a given file
 */
function ruleApplies(rule: ValidationRule, filePath: string): boolean {
  // Check if file matches any of the appliesTo patterns
  const applies = rule.appliesTo.some((pattern) => matchesPattern(filePath, pattern))

  if (!applies) {
    return false
  }

  // Check if file matches any exclude patterns
  if (rule.excludes) {
    const excluded = rule.excludes.some((pattern) => matchesPattern(filePath, pattern))
    if (excluded) {
      return false
    }
  }

  return true
}

interface ValidateFileOptions {
  /** Specific rules to run (by name). If not provided, runs all applicable rules */
  rules?: string[]
  /** Project root for context */
  projectRoot?: string
}

/**
 * Validate a single file against convention rules
 */
export async function validateFile(filePath: string, options: ValidateFileOptions = {}): Promise<ValidationResult> {
  const projectRoot = options.projectRoot || process.cwd()
  const relativePath = filePath.startsWith(projectRoot) ? path.relative(projectRoot, filePath) : filePath

  // Create ts-morph project and load the file
  const project = new Project({skipFileDependencyResolution: true})

  let sourceFile: SourceFile
  try {
    sourceFile = project.addSourceFileAtPath(path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath))
  } catch (error) {
    return {
      file: relativePath,
      valid: false,
      violations: [
        {rule: 'file-parse', severity: 'CRITICAL', line: 0, message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`}
      ],
      passed: [],
      skipped: []
    }
  }

  const violations: Violation[] = []
  const passed: string[] = []
  const skipped: string[] = []

  // Determine which rules to run
  const rulesToRun = options.rules ? options.rules.map((name) => rulesByName[name]).filter(Boolean) : allRules

  for (const rule of rulesToRun) {
    if (!ruleApplies(rule, relativePath)) {
      skipped.push(rule.name)
      continue
    }

    try {
      const ruleViolations = rule.validate(sourceFile, relativePath)
      if (ruleViolations.length > 0) {
        violations.push(...ruleViolations)
      } else {
        passed.push(rule.name)
      }
    } catch (error) {
      violations.push({
        rule: rule.name,
        severity: 'HIGH',
        line: 0,
        message: `Rule execution failed: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  }

  return {file: relativePath, valid: violations.length === 0, violations, passed, skipped}
}

/**
 * Validate multiple files
 */
export async function validateFiles(filePaths: string[], options: ValidateFileOptions = {}): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []
  for (const filePath of filePaths) {
    const result = await validateFile(filePath, options)
    results.push(result)
  }
  return results
}

/**
 * Get validation summary for multiple results
 */
export function getValidationSummary(
  results: ValidationResult[]
): {
  totalFiles: number
  validFiles: number
  invalidFiles: number
  totalViolations: number
  violationsBySeverity: Record<string, number>
  violationsByRule: Record<string, number>
} {
  const violationsBySeverity: Record<string, number> = {}
  const violationsByRule: Record<string, number> = {}
  let totalViolations = 0

  for (const result of results) {
    for (const violation of result.violations) {
      totalViolations++
      violationsBySeverity[violation.severity] = (violationsBySeverity[violation.severity] || 0) + 1
      violationsByRule[violation.rule] = (violationsByRule[violation.rule] || 0) + 1
    }
  }

  return {
    totalFiles: results.length,
    validFiles: results.filter((r) => r.valid).length,
    invalidFiles: results.filter((r) => !r.valid).length,
    totalViolations,
    violationsBySeverity,
    violationsByRule
  }
}
