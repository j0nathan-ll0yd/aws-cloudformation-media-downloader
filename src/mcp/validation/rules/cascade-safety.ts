/**
 * Cascade Safety Rule
 * CRITICAL: Detect unsafe cascade deletion patterns
 *
 * This enforces:
 * 1. Use Promise.allSettled instead of Promise.all for cascade operations
 * 2. Delete child entities before parent entities
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'cascade-safety'
const SEVERITY = 'CRITICAL' as const

/**
 * Entity deletion patterns that indicate cascade operations
 */
const DELETE_PATTERNS = ['.delete(', '.remove(', 'batchWrite']

/**
 * Entity hierarchy for checking parent-child relationships
 * Children should be deleted before parents
 */
const ENTITY_HIERARCHY: Record<string, string[]> = {
  Users: ['UserFiles', 'UserDevices', 'Sessions', 'Accounts'],
  Files: ['UserFiles'],
  Devices: ['UserDevices']
}

export const cascadeSafetyRule: ValidationRule = {
  name: RULE_NAME,
  description:
    'Use Promise.allSettled instead of Promise.all for cascade deletions. Delete child entities before parent entities to maintain referential integrity.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/**/src/*.ts'],
  excludes: ['src/**/*.test.ts', 'test/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    // filePath used for context in error messages
    void filePath
    const violations: Violation[] = []

    // Find all Promise.all calls
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const call of callExpressions) {
      const expression = call.getExpression()
      const expressionText = expression.getText()

      // Check for Promise.all
      if (expressionText === 'Promise.all') {
        const args = call.getArguments()
        if (args.length === 0) {
          continue
        }

        const firstArg = args[0]
        const argText = firstArg.getText()

        // Check if the array contains delete operations
        const hasDeleteOps = DELETE_PATTERNS.some((pattern) => argText.includes(pattern))

        if (hasDeleteOps) {
          const line = call.getStartLineNumber()
          violations.push(
            createViolation(RULE_NAME, SEVERITY, line,
              'Promise.all with delete operations detected. Use Promise.allSettled for cascade deletions to handle partial failures gracefully.', {
              suggestion: 'Replace Promise.all with Promise.allSettled and check results for rejected promises',
              codeSnippet: call.getText().substring(0, 100)
            })
          )
        }
      }
    }

    // Check for entity deletion order violations
    // Look for await expressions that might have incorrect ordering
    const awaitExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression)
    const deleteSequence: Array<{entity: string; line: number}> = []

    for (const awaitExpr of awaitExpressions) {
      const text = awaitExpr.getText()

      // Check if this is a delete operation on a known entity
      for (const [parent, children] of Object.entries(ENTITY_HIERARCHY)) {
        // Check for parent entity deletion
        // Use regex to ensure exact match (avoid matching UserFiles.delete as Files.delete)
        const parentRegex = new RegExp(`\\b${parent}\\.(delete|remove)`)
        if (parentRegex.test(text)) {
          deleteSequence.push({entity: parent, line: awaitExpr.getStartLineNumber()})
        }

        // Check for child entity deletions
        for (const child of children) {
          const childRegex = new RegExp(`\\b${child}\\.(delete|remove)`)
          if (childRegex.test(text)) {
            deleteSequence.push({entity: child, line: awaitExpr.getStartLineNumber()})
          }
        }
      }
    }

    // Analyze deletion sequence for order violations
    for (let i = 0; i < deleteSequence.length; i++) {
      const current = deleteSequence[i]

      // Check if this is a parent entity
      const children = ENTITY_HIERARCHY[current.entity]
      if (!children) {
        continue
      }

      // Check if any child deletions come AFTER this parent deletion
      for (let j = i + 1; j < deleteSequence.length; j++) {
        const later = deleteSequence[j]
        if (children.includes(later.entity)) {
          violations.push(
            createViolation(RULE_NAME, SEVERITY, current.line,
              `Incorrect cascade order: ${current.entity} deleted before ${later.entity}. Delete child entities first.`, {
              suggestion: `Delete ${later.entity} before ${current.entity} to maintain referential integrity`,
              codeSnippet: `${current.entity} deleted at line ${current.line}, ${later.entity} at line ${later.line}`
            })
          )
        }
      }
    }

    return violations
  }
}
