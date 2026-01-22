/**
 * Tests for database-permissions validation rule
 *
 * DEPRECATED: This rule is no longer active.
 * Database permissions are now derived automatically from @RequiresTable decorators
 * on entity query methods via build-time call-graph analysis.
 * See: scripts/extractEntityPermissions.ts
 */

import {describe, expect, it} from 'vitest'
import {Project} from 'ts-morph'
import {databasePermissionsRule} from './database-permissions'

function createSourceFile(code: string) {
  const project = new Project({useInMemoryFileSystem: true})
  return project.createSourceFile('test.ts', code)
}

describe('database-permissions rule (DEPRECATED)', () => {
  it('should return no violations (rule is deprecated)', () => {
    const code = `
      import {getUser} from '#entities/queries'
      import {ApiHandler} from '#lib/lambda/handlers'

      class MyHandler extends ApiHandler {
        async executeApi() {
          const user = await getUser('123')
          return {statusCode: 200, body: JSON.stringify(user)}
        }
      }
    `
    const sourceFile = createSourceFile(code)
    const violations = databasePermissionsRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')
    expect(violations).toHaveLength(0)
  })

  it('should have correct metadata', () => {
    expect(databasePermissionsRule.name).toBe('database-permissions')
    expect(databasePermissionsRule.description).toContain('DEPRECATED')
    expect(databasePermissionsRule.appliesTo).toContain('src/lambdas/*/src/index.ts')
  })
})
