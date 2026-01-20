/**
 * CI/CD Conventions Validation
 * MEDIUM: Validates GitHub Actions workflow conventions
 *
 * This rule validates YAML workflow files using text-based parsing
 * (not ts-morph AST) since workflows are YAML, not TypeScript.
 */

import {readdirSync, readFileSync} from 'fs'
import {join} from 'path'
import type {ValidationSeverity} from '../types'

export interface CicdViolation {
  rule: string
  severity: ValidationSeverity
  file: string
  line?: number
  message: string
  suggestion?: string
}

/**
 * Validate GitHub Actions workflow conventions
 *
 * Rules enforced:
 * - CICD-001: Workflows should use actions/checkout v6
 * - CICD-002: Workflows should use reusable setup-node-pnpm action
 * - CICD-003: PR workflows should have concurrency group
 * - CICD-004: Workflows should use actions/upload-artifact v6
 * - CICD-005: Workflows should use actions/download-artifact v7
 */
export function validateCicdConventions(projectRoot: string): CicdViolation[] {
  const results: CicdViolation[] = []
  const workflowsDir = join(projectRoot, '.github', 'workflows')

  try {
    const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))

    for (const file of files) {
      const filePath = join(workflowsDir, file)
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const relativeFile = `.github/workflows/${file}`

      // Rule 1: Workflows should use actions/checkout@v6
      const checkoutMatch = content.match(/actions\/checkout@v(\d+)/)
      if (checkoutMatch && checkoutMatch[1] !== '6') {
        const lineNum = findLineNumber(lines, 'actions/checkout@')
        results.push({
          rule: 'CICD-001',
          severity: 'MEDIUM',
          file: relativeFile,
          line: lineNum,
          message: `Workflow uses actions/checkout@v${checkoutMatch[1]}, should use @v6`,
          suggestion: 'Update to actions/checkout@v6 for latest features'
        })
      }

      // Rule 2: Workflows should use reusable setup-node-pnpm action (if they use pnpm/action-setup)
      if (content.includes('pnpm/action-setup') && !content.includes('./.github/actions/setup-node-pnpm')) {
        const lineNum = findLineNumber(lines, 'pnpm/action-setup')
        results.push({
          rule: 'CICD-002',
          severity: 'HIGH',
          file: relativeFile,
          line: lineNum,
          message: 'Workflow uses pnpm/action-setup directly instead of reusable action',
          suggestion: 'Use ./.github/actions/setup-node-pnpm for consistency and caching'
        })
      }

      // Rule 3: PR workflows should have concurrency group
      if (content.includes('pull_request:') && !content.includes('concurrency:')) {
        results.push({
          rule: 'CICD-003',
          severity: 'MEDIUM',
          file: relativeFile,
          message: 'PR workflow missing concurrency group',
          suggestion:
            'Add concurrency group to cancel outdated PR runs: concurrency: { group: pr-${{ github.event.pull_request.number }}, cancel-in-progress: true }'
        })
      }

      // Rule 4: Workflows should use actions/upload-artifact@v6
      const uploadMatch = content.match(/actions\/upload-artifact@v(\d+)/)
      if (uploadMatch && parseInt(uploadMatch[1], 10) < 6) {
        const lineNum = findLineNumber(lines, 'actions/upload-artifact@')
        results.push({
          rule: 'CICD-004',
          severity: 'MEDIUM',
          file: relativeFile,
          line: lineNum,
          message: `Workflow uses actions/upload-artifact@v${uploadMatch[1]}, should use @v6`,
          suggestion: 'Update to actions/upload-artifact@v6'
        })
      }

      // Rule 5: Workflows should use actions/download-artifact@v7
      const downloadMatch = content.match(/actions\/download-artifact@v(\d+)/)
      if (downloadMatch && parseInt(downloadMatch[1], 10) < 7) {
        const lineNum = findLineNumber(lines, 'actions/download-artifact@')
        results.push({
          rule: 'CICD-005',
          severity: 'MEDIUM',
          file: relativeFile,
          line: lineNum,
          message: `Workflow uses actions/download-artifact@v${downloadMatch[1]}, should use @v7`,
          suggestion: 'Update to actions/download-artifact@v7'
        })
      }
    }
  } catch {
    // Workflows directory doesn't exist or can't be read - not an error
  }

  return results
}

/**
 * Find line number where a pattern appears
 */
function findLineNumber(lines: string[], pattern: string): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(pattern)) {
      return i + 1
    }
  }
  return undefined
}

/**
 * Get summary of CI/CD validation results
 */
export function getCicdValidationSummary(
  violations: CicdViolation[]
): {valid: boolean; total: number; byRule: Record<string, number>; bySeverity: Record<string, number>} {
  const byRule: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}

  for (const v of violations) {
    byRule[v.rule] = (byRule[v.rule] || 0) + 1
    bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1
  }

  return {valid: violations.length === 0, total: violations.length, byRule, bySeverity}
}
