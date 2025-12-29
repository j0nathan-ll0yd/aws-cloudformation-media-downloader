/**
 * Cascade Safety Rule
 * CRITICAL: Detect unsafe cascade deletion patterns
 *
 * This enforces:
 * 1. Use Promise.allSettled instead of Promise.all for cascade operations
 * 2. Delete child entities before parent entities
 *
 * Supports both legacy ElectroDB patterns and native Drizzle query functions.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'cascade-safety'
const SEVERITY = 'CRITICAL' as const

/**
 * Deletion patterns that indicate cascade operations
 * Includes both legacy ElectroDB and native Drizzle query function patterns
 */
const DELETE_PATTERNS = [
  // Legacy ElectroDB patterns
  '.delete(',
  '.remove(',
  'batchWrite',
  // Native Drizzle query function patterns
  'deleteUser(',
  'deleteFile(',
  'deleteDevice(',
  'deleteSession(',
  'deleteAccount(',
  'deleteUserFile(',
  'deleteUserDevice(',
  'deleteUserFilesByUserId(',
  'deleteUserDevicesByUserId(',
  'deleteUserDevicesByDeviceId(',
  'deleteSessionsByUserId(',
  'deleteAccountsByUserId('
]

/**
 * Entity hierarchy for checking parent-child relationships
 * Children should be deleted before parents
 */
const ENTITY_HIERARCHY: Record<string, string[]> = {
  Users: ['UserFiles', 'UserDevices', 'Sessions', 'Accounts'],
  Files: ['UserFiles'],
  Devices: ['UserDevices']
}

/**
 * Native Drizzle function hierarchy mapping
 * Maps parent delete functions to their child delete functions
 */
const FUNCTION_HIERARCHY: Record<string, string[]> = {
  deleteUser: ['deleteUserFilesByUserId', 'deleteUserDevicesByUserId', 'deleteSessionsByUserId', 'deleteAccountsByUserId'],
  deleteFile: ['deleteUserFile'],
  deleteDevice: ['deleteUserDevicesByDeviceId', 'deleteUserDevice']
}

/**
 * Pre-compiled regexes for entity deletion detection (performance optimization)
 * Supports both legacy ElectroDB and native Drizzle patterns
 */
const ENTITY_DELETE_REGEXES: Record<string, RegExp> = Object.fromEntries(
  [...Object.keys(ENTITY_HIERARCHY), ...Object.values(ENTITY_HIERARCHY).flat()].map((entity) => [entity, new RegExp(`\\b${entity}\\.(delete|remove)`)])
)

/**
 * Pre-compiled regexes for native Drizzle function deletion detection
 */
const FUNCTION_DELETE_REGEXES: Record<string, RegExp> = Object.fromEntries(
  [...Object.keys(FUNCTION_HIERARCHY), ...Object.values(FUNCTION_HIERARCHY).flat()].map((fn) => [fn, new RegExp(`\\b${fn}\\s*\\(`)])
)

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

    // Check for deletion order violations in await expressions
    const awaitExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression)

    // Track legacy ElectroDB entity deletions
    const entityDeleteSequence: Array<{entity: string; line: number}> = []
    // Track native Drizzle function deletions
    const functionDeleteSequence: Array<{fn: string; line: number}> = []

    for (const awaitExpr of awaitExpressions) {
      const text = awaitExpr.getText()

      // Check for legacy ElectroDB entity deletions
      for (const [parent, children] of Object.entries(ENTITY_HIERARCHY)) {
        if (ENTITY_DELETE_REGEXES[parent].test(text)) {
          entityDeleteSequence.push({entity: parent, line: awaitExpr.getStartLineNumber()})
        }
        for (const child of children) {
          if (ENTITY_DELETE_REGEXES[child].test(text)) {
            entityDeleteSequence.push({entity: child, line: awaitExpr.getStartLineNumber()})
          }
        }
      }

      // Check for native Drizzle function deletions
      for (const [parentFn, childFns] of Object.entries(FUNCTION_HIERARCHY)) {
        if (FUNCTION_DELETE_REGEXES[parentFn].test(text)) {
          functionDeleteSequence.push({fn: parentFn, line: awaitExpr.getStartLineNumber()})
        }
        for (const childFn of childFns) {
          if (FUNCTION_DELETE_REGEXES[childFn].test(text)) {
            functionDeleteSequence.push({fn: childFn, line: awaitExpr.getStartLineNumber()})
          }
        }
      }
    }

    // Analyze legacy entity deletion sequence for order violations
    for (let i = 0; i < entityDeleteSequence.length; i++) {
      const current = entityDeleteSequence[i]
      const children = ENTITY_HIERARCHY[current.entity]
      if (!children) {
        continue
      }

      for (let j = i + 1; j < entityDeleteSequence.length; j++) {
        const later = entityDeleteSequence[j]
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

    // Analyze native Drizzle function deletion sequence for order violations
    for (let i = 0; i < functionDeleteSequence.length; i++) {
      const current = functionDeleteSequence[i]
      const childFns = FUNCTION_HIERARCHY[current.fn]
      if (!childFns) {
        continue
      }

      for (let j = i + 1; j < functionDeleteSequence.length; j++) {
        const later = functionDeleteSequence[j]
        if (childFns.includes(later.fn)) {
          violations.push(
            createViolation(RULE_NAME, SEVERITY, current.line,
              `Incorrect cascade order: ${current.fn}() called before ${later.fn}(). Delete child records first.`, {
              suggestion: `Call ${later.fn}() before ${current.fn}() to maintain referential integrity`,
              codeSnippet: `${current.fn}() at line ${current.line}, ${later.fn}() at line ${later.line}`
            })
          )
        }
      }
    }

    return violations
  }
}
