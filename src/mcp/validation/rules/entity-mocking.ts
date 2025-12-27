/**
 * Entity Mocking Rule
 * CRITICAL: Test files must use createEntityMock() helper
 *
 * This ensures consistent mocking patterns and proper type safety.
 * Entities use Drizzle internally but expose ElectroDB-compatible API.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'entity-mocking'
const SEVERITY = 'CRITICAL' as const

/**
 * Entity names that should be mocked with the helper
 */
const ENTITY_NAMES = ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices', 'Sessions', 'Accounts', 'Verifications', 'FileDownloads']

export const entityMockingRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Test files must use createEntityMock() from test/helpers/entity-mock.ts for mocking entities.',
  severity: SEVERITY,
  appliesTo: ['src/**/*.test.ts', 'test/**/*.ts'],
  excludes: ['test/helpers/**/*.ts'],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Only check test files
    if (!filePath.includes('.test.') && !filePath.includes('/test/')) {
      return violations
    }

    // Skip the helper file itself
    if (filePath.includes('entity-mock') || filePath.includes('electrodb-mock')) {
      return violations
    }

    const content = sourceFile.getFullText()

    // Check if file imports any entities
    const imports = sourceFile.getImportDeclarations()
    const importsEntities = imports.some((imp) => {
      const moduleSpec = imp.getModuleSpecifierValue()
      return moduleSpec.includes('entities/') || ENTITY_NAMES.some((e) => moduleSpec.includes(e))
    })

    // Check if file mocks entities
    const mocksEntities = ENTITY_NAMES.some((entity) => content.includes(`#entities/${entity}`) || content.includes(`entities/${entity}`))

    if (!importsEntities && !mocksEntities) {
      return violations // No entity usage, rule doesn't apply
    }

    // Check if createEntityMock (or legacy createElectroDBEntityMock) is imported
    const hasCorrectImport = imports.some((imp) => {
      const moduleSpec = imp.getModuleSpecifierValue()
      const namedImports = imp.getNamedImports().map((n) => n.getName())
      return (moduleSpec.includes('entity-mock') || moduleSpec.includes('electrodb-mock') || moduleSpec.includes('test/helpers')) &&
        (namedImports.includes('createEntityMock') || namedImports.includes('createElectroDBEntityMock'))
    })

    // Check for manual entity mocking patterns
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const call of callExpressions) {
      const expression = call.getExpression()
      const expressionText = expression.getText()

      // Check for vi.mock (Vitest) or legacy jest.mock/jest.unstable_mockModule with entity paths
      if (expressionText === 'vi.mock' || expressionText === 'jest.unstable_mockModule' || expressionText === 'jest.mock') {
        const args = call.getArguments()
        if (args.length > 0) {
          const modulePath = args[0].getText().replace(/['"]/g, '')

          // Check if mocking an entity
          const isEntityMock = modulePath.includes('entities/') || ENTITY_NAMES.some((e) => modulePath.includes(e))

          if (isEntityMock && args.length > 1) {
            // Check if the mock implementation uses createEntityMock (or legacy name)
            const mockImpl = args[1].getText()

            if (!mockImpl.includes('createEntityMock') && !mockImpl.includes('createElectroDBEntityMock')) {
              violations.push(
                createViolation(RULE_NAME, SEVERITY, call.getStartLineNumber(),
                  `Manual entity mock detected for '${modulePath}'. Use createEntityMock() instead.`, {
                  suggestion: `const ${modulePath.split('/').pop()}Mock = createEntityMock({...})\nvi.mock('${modulePath}', () => ({${
                    modulePath.split('/').pop()
                  }: ${modulePath.split('/').pop()}Mock.entity}))`,
                  codeSnippet: call.getText().substring(0, 150)
                })
              )
            }
          }
        }
      }
    }

    // If file mocks entities but doesn't import the helper
    if (mocksEntities && !hasCorrectImport && violations.length === 0) {
      // Check if they're using the mock helper correctly
      const usesHelper = content.includes('createEntityMock') || content.includes('createElectroDBEntityMock')
      if (!usesHelper) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, 1, 'File mocks entities but does not use createEntityMock() helper', {
            suggestion: "import {createEntityMock} from '../../../../test/helpers/entity-mock'"
          })
        )
      }
    }

    return violations
  }
}

/** @deprecated Use entityMockingRule instead */
export const electrodbMockingRule = entityMockingRule
