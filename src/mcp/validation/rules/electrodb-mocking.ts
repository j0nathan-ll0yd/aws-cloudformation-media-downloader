/**
 * ElectroDB Mocking Rule
 * CRITICAL: Test files must use createElectroDBEntityMock() helper
 *
 * This ensures consistent mocking patterns and proper type safety.
 */

import type {SourceFile} from 'ts-morph'
import {SyntaxKind} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'electrodb-mocking'
const SEVERITY = 'CRITICAL' as const

/**
 * Entity names that should be mocked with the helper
 */
const ENTITY_NAMES = ['Users', 'Files', 'Devices', 'UserFiles', 'UserDevices', 'Sessions', 'Accounts', 'Verifications']

export const electrodbMockingRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Test files must use createElectroDBEntityMock() from test/helpers/electrodb-mock.ts for mocking ElectroDB entities.',
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
    if (filePath.includes('electrodb-mock')) {
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

    // Check if createElectroDBEntityMock is imported
    const hasCorrectImport = imports.some((imp) => {
      const moduleSpec = imp.getModuleSpecifierValue()
      const namedImports = imp.getNamedImports().map((n) => n.getName())
      return (moduleSpec.includes('electrodb-mock') || moduleSpec.includes('test/helpers')) && namedImports.includes('createElectroDBEntityMock')
    })

    // Check for manual entity mocking patterns
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

    for (const call of callExpressions) {
      const expression = call.getExpression()
      const expressionText = expression.getText()

      // Check for jest.unstable_mockModule with entity paths
      if (expressionText === 'jest.unstable_mockModule' || expressionText === 'jest.mock') {
        const args = call.getArguments()
        if (args.length > 0) {
          const modulePath = args[0].getText().replace(/['"]/g, '')

          // Check if mocking an entity
          const isEntityMock = modulePath.includes('entities/') || ENTITY_NAMES.some((e) => modulePath.includes(e))

          if (isEntityMock && args.length > 1) {
            // Check if the mock implementation uses createElectroDBEntityMock
            const mockImpl = args[1].getText()

            if (!mockImpl.includes('createElectroDBEntityMock')) {
              violations.push(
                createViolation(RULE_NAME, SEVERITY, call.getStartLineNumber(),
                  `Manual entity mock detected for '${modulePath}'. Use createElectroDBEntityMock() instead.`, {
                  suggestion: `const ${
                    modulePath.split('/').pop()
                  }Mock = createElectroDBEntityMock({...})\njest.unstable_mockModule('${modulePath}', () => ({${modulePath.split('/').pop()}: ${
                    modulePath.split('/').pop()
                  }Mock.entity}))`,
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
      const usesHelper = content.includes('createElectroDBEntityMock')
      if (!usesHelper) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, 1, 'File mocks ElectroDB entities but does not use createElectroDBEntityMock() helper', {
            suggestion: "import {createElectroDBEntityMock} from '../../../../test/helpers/electrodb-mock'"
          })
        )
      }
    }

    return violations
  }
}
