/**
 * Shared validation types for MCP convention checking
 * These types can be reused by CI scripts and future tooling
 */

import type {SourceFile} from 'ts-morph'

export type ValidationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface Violation {
  rule: string
  severity: ValidationSeverity
  line: number
  column?: number
  message: string
  suggestion?: string
  codeSnippet?: string
}

export interface ValidationResult {
  file: string
  valid: boolean
  violations: Violation[]
  passed: string[]
  skipped: string[]
}

export interface ValidationRule {
  /** Unique identifier for the rule */
  name: string

  /** Human-readable description */
  description: string

  /** Severity level if violated */
  severity: ValidationSeverity

  /** File patterns this rule applies to (glob-like) */
  appliesTo: string[]

  /** File patterns to exclude from this rule */
  excludes?: string[]

  /** Validate a source file and return violations */
  validate(sourceFile: SourceFile, filePath: string): Violation[]
}

export interface ValidationContext {
  /** Project root directory */
  projectRoot: string

  /** File being validated */
  filePath: string

  /** Whether this is a test file */
  isTestFile: boolean

  /** Whether this is a Lambda handler */
  isLambdaHandler: boolean

  /** Whether this is in the vendor directory */
  isVendorFile: boolean
}

/**
 * Helper to create a violation object
 * @param rule
 * @param severity
 * @param line
 * @param message
 * @param options
 * @param options.column
 * @param options.suggestion
 * @param options.codeSnippet
 */
export function createViolation(
  rule: string,
  severity: ValidationSeverity,
  line: number,
  message: string,
  options?: {column?: number; suggestion?: string; codeSnippet?: string}
): Violation {
  return {rule, severity, line, message, ...options}
}

/**
 * Determine validation context from file path
 * @param filePath
 * @param projectRoot
 */
export function getValidationContext(filePath: string, projectRoot: string): ValidationContext {
  return {
    projectRoot,
    filePath,
    isTestFile: filePath.includes('.test.') || filePath.includes('/test/'),
    isLambdaHandler: filePath.includes('/lambdas/') && filePath.includes('/src/index.ts'),
    isVendorFile: filePath.includes('/lib/vendor/')
  }
}
