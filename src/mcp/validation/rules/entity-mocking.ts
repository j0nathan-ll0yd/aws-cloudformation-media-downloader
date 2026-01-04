/**
 * Entity Mocking Rule
 * CRITICAL: Test files should mock entity query functions consistently
 *
 * With native Drizzle query functions, tests mock `#entities/queries` directly
 * using standard vi.mock() patterns with vi.fn() for each function.
 *
 * This rule validates that entity query mocks are properly structured.
 * Using deprecated legacy-style mocks will cause test failures when the
 * entity layer changes. Correct mocking is critical for test reliability.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'entity-mocking'
const SEVERITY = 'CRITICAL' as const

/** Entity names used to detect deprecated import patterns in tests */
const LEGACY_ENTITY_NAMES = ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices', 'Sessions', 'Accounts', 'Verifications', 'FileDownloads']

export const entityMockingRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Test files should mock #entities/queries with vi.fn() for each query function. Legacy entity module mocks are deprecated.',
  severity: SEVERITY,
  appliesTo: ['src/**/*.test.ts', 'test/**/*.ts'],
  excludes: ['test/helpers/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Only check test files
    if (!filePath.includes('.test.') && !filePath.includes('/test/')) {
      return violations
    }

    // Skip helper files
    if (filePath.includes('entity-mock') || filePath.includes('drizzle-mock')) {
      return violations
    }

    // Check for legacy entity imports (deprecated pattern)
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const call of callExpressions) {
      const expression = call.getExpression()
      const expressionText = expression.getText()

      // Check for vi.mock with legacy entity paths
      if (expressionText === 'vi.mock' || expressionText === 'jest.mock') {
        const args = call.getArguments()
        if (args.length > 0) {
          const modulePath = args[0].getText().replace(/['"]/g, '')

          // Check if mocking a legacy entity directly (not #entities/queries)
          const isLegacyEntityMock = LEGACY_ENTITY_NAMES.some((e) => modulePath === `#entities/${e}` || modulePath.endsWith(`/entities/${e}`))

          if (isLegacyEntityMock) {
            violations.push(
              createViolation(RULE_NAME, SEVERITY, call.getStartLineNumber(),
                `Legacy entity mock detected for '${modulePath}'. Use #entities/queries instead.`, {
                suggestion: `vi.mock('#entities/queries', () => ({\n  getUser: vi.fn(),\n  createUser: vi.fn(),\n  // ... other functions\n}))`,
                codeSnippet: call.getText().substring(0, 150)
              })
            )
          }

          // Check if using deprecated createEntityMock helper
          if (args.length > 1) {
            const mockImpl = args[1].getText()
            if (mockImpl.includes('createEntityMock')) {
              violations.push(
                createViolation(RULE_NAME, SEVERITY, call.getStartLineNumber(),
                  'createEntityMock() helper is deprecated. Use direct vi.fn() mocks with #entities/queries.', {
                  suggestion: `vi.mock('#entities/queries', () => ({\n  getUser: vi.fn(),\n  createUser: vi.fn(),\n  // ... other functions as needed\n}))`,
                  codeSnippet: call.getText().substring(0, 150)
                })
              )
            }
          }
        }
      }
    }

    return violations
  }
}
