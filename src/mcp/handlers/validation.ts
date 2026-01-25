/**
 * Validation handler for MCP server
 * Provides AST-based pattern validation against project conventions
 *
 * Uses the shared validation core from src/mcp/validation/
 */

import path from 'path'
import {fileURLToPath} from 'url'
import {allRules, rulesByName, validateFile} from '../validation/index.js'
import {createErrorResponse} from './shared/response-types.js'
import {getCicdValidationSummary, validateCicdConventions} from '../validation/rules/cicd-conventions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../..')

export type ValidationQueryType = 'all' | 'aws-sdk' | 'cicd' | 'entity' | 'imports' | 'response' | 'rules' | 'summary'

export interface ValidationQueryArgs {
  file?: string
  query: ValidationQueryType
}

/** Handles MCP queries for running convention validation rules. */
export async function handleValidationQuery(args: ValidationQueryArgs) {
  const {file, query} = args
  switch (query) {
    case 'rules': {
      // List all available validation rules
      return {
        rules: allRules.map((rule) => ({
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          appliesTo: rule.appliesTo,
          excludes: rule.excludes
        })),
        aliases: Object.entries(rulesByName).filter(([alias, rule]) => alias !== rule.name).map(([alias, rule]) => ({alias, rule: rule.name}))
      }
    }

    case 'all': {
      if (!file) {
        return createErrorResponse('File path required for validation', 'Example: {file: "src/lambdas/ListFiles/src/index.ts", query: "all"}')
      }

      const filePath = path.isAbsolute(file) ? file : path.join(projectRoot, file)
      const result = await validateFile(filePath, {projectRoot})

      return {
        file: result.file,
        valid: result.valid,
        violations: result.violations,
        passed: result.passed,
        skipped: result.skipped,
        summary: result.valid ? 'All applicable rules passed' : `${result.violations.length} violation(s) found`
      }
    }

    case 'aws-sdk': {
      if (!file) {
        return createErrorResponse('File path required', 'Validates AWS SDK encapsulation (CRITICAL rule)')
      }

      const filePath = path.isAbsolute(file) ? file : path.join(projectRoot, file)
      const result = await validateFile(filePath, {projectRoot, rules: ['aws-sdk-encapsulation']})

      return {
        file: result.file,
        rule: 'aws-sdk-encapsulation',
        severity: 'CRITICAL',
        valid: result.valid,
        violations: result.violations,
        message: result.valid
          ? 'No direct AWS SDK imports found. File follows encapsulation policy.'
          : 'CRITICAL: Direct AWS SDK imports detected. Use lib/vendor/AWS/ wrappers.'
      }
    }

    case 'cicd': {
      // Validate CI/CD workflow conventions (YAML files, not TypeScript)
      const violations = validateCicdConventions(projectRoot)
      const summary = getCicdValidationSummary(violations)

      return {
        rules: ['CICD-001', 'CICD-002', 'CICD-003', 'CICD-004', 'CICD-005'],
        valid: summary.valid,
        violations,
        summary,
        message: summary.valid
          ? 'All CI/CD workflows follow project conventions.'
          : `Found ${summary.total} CI/CD convention violation(s).`
      }
    }

    case 'entity': {
      if (!file) {
        return createErrorResponse('File path required', 'Validates entity mocking patterns in test files (CRITICAL rule)')
      }

      const filePath = path.isAbsolute(file) ? file : path.join(projectRoot, file)
      const result = await validateFile(filePath, {projectRoot, rules: ['entity-mocking']})

      return {
        file: result.file,
        rule: 'entity-mocking',
        severity: 'CRITICAL',
        valid: result.valid,
        violations: result.violations,
        skipped: result.skipped.includes('entity-mocking') ? 'Rule skipped: Not a test file or no entity mocks' : undefined,
        message: result.valid
          ? 'Entities are mocked correctly using vi.fn() with #entities/queries.'
          : 'CRITICAL: Legacy entity mocks detected. Use vi.fn() with #entities/queries.'
      }
    }

    case 'imports': {
      if (!file) {
        return createErrorResponse('File path required', 'Validates import ordering in Lambda handlers (MEDIUM rule)')
      }

      const filePath = path.isAbsolute(file) ? file : path.join(projectRoot, file)
      const result = await validateFile(filePath, {projectRoot, rules: ['import-order']})

      return {
        file: result.file,
        rule: 'import-order',
        severity: 'MEDIUM',
        valid: result.valid,
        violations: result.violations,
        skipped: result.skipped.includes('import-order') ? 'Rule skipped: Not a Lambda handler file' : undefined,
        expectedOrder: ['node-builtins', 'aws-lambda-types', 'external-packages', 'entities', 'vendor', 'types', 'utilities', 'relative']
      }
    }

    case 'response': {
      if (!file) {
        return createErrorResponse('File path required', 'Validates response helper usage in Lambda handlers (HIGH rule)')
      }

      const filePath = path.isAbsolute(file) ? file : path.join(projectRoot, file)
      const result = await validateFile(filePath, {projectRoot, rules: ['response-helpers']})

      return {
        file: result.file,
        rule: 'response-helpers',
        severity: 'HIGH',
        valid: result.valid,
        violations: result.violations,
        skipped: result.skipped.includes('response-helpers') ? 'Rule skipped: Not a Lambda handler file' : undefined,
        message: result.valid
          ? 'Lambda uses buildApiResponse() helper correctly.'
          : 'Raw response objects detected. Use buildApiResponse() for consistent formatting.'
      }
    }

    case 'summary': {
      // Validate a file and return a concise summary
      if (!file) {
        return createErrorResponse('File path required', 'Example: {file: "src/lambdas/ListFiles/src/index.ts", query: "summary"}')
      }

      const filePath = path.isAbsolute(file) ? file : path.join(projectRoot, file)
      const result = await validateFile(filePath, {projectRoot})

      const criticalViolations = result.violations.filter((v) => v.severity === 'CRITICAL')
      const highViolations = result.violations.filter((v) => v.severity === 'HIGH')
      const mediumViolations = result.violations.filter((v) => v.severity === 'MEDIUM')

      return {
        file: result.file,
        valid: result.valid,
        summary: {
          critical: criticalViolations.length,
          high: highViolations.length,
          medium: mediumViolations.length,
          passed: result.passed.length,
          skipped: result.skipped.length
        },
        criticalIssues: criticalViolations.map((v) => ({rule: v.rule, line: v.line, message: v.message})),
        recommendation: criticalViolations.length > 0
          ? 'CRITICAL issues must be fixed before committing'
          : highViolations.length > 0
          ? 'HIGH priority issues should be addressed'
          : result.valid
          ? 'File passes all convention checks'
          : 'Minor issues detected'
      }
    }

    default:
      return createErrorResponse(`Unknown query: ${query}`, 'Available queries: all, aws-sdk, cicd, entity, imports, response, rules, summary')
  }
}
