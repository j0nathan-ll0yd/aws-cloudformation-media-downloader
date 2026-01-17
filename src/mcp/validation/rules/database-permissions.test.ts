/**
 * Tests for database-permissions validation rule
 */

import {describe, expect, it} from 'vitest'
import {Project} from 'ts-morph'
import {databasePermissionsRule} from './database-permissions'

function createSourceFile(code: string) {
  const project = new Project({useInMemoryFileSystem: true})
  return project.createSourceFile('test.ts', code)
}

describe('database-permissions rule', () => {
  it('should pass for Lambda with no entity imports', () => {
    const code = `
      import {ApiHandler} from '#lib/lambda/handlers'

      class MyHandler extends ApiHandler {
        async executeApi() {
          return {statusCode: 200, body: '{}'}
        }
      }
    `
    const sourceFile = createSourceFile(code)
    const violations = databasePermissionsRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')
    expect(violations).toHaveLength(0)
  })

  it('should fail for Lambda with entity imports but no @RequiresDatabase', () => {
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
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('missing @RequiresDatabase decorator')
  })

  it('should pass for Lambda with @RequiresDatabase decorator and matching permissions', () => {
    const code = `
      import {getUser} from '#entities/queries'
      import {ApiHandler, RequiresDatabase} from '#lib/lambda/handlers'
      import {DatabaseTable, DatabaseOperation} from '#types/databasePermissions'

      @RequiresDatabase({
        tables: [
          {table: DatabaseTable.Users, operations: [DatabaseOperation.Select]}
        ]
      })
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

  it('should fail for Lambda with @RequiresDatabase but missing table permissions', () => {
    const code = `
      import {getUser, getFile} from '#entities/queries'
      import {ApiHandler, RequiresDatabase} from '#lib/lambda/handlers'
      import {DatabaseTable, DatabaseOperation} from '#types/databasePermissions'

      @RequiresDatabase({
        tables: [
          {table: DatabaseTable.Users, operations: [DatabaseOperation.Select]}
        ]
      })
      class MyHandler extends ApiHandler {
        async executeApi() {
          const user = await getUser('123')
          const file = await getFile('456')
          return {statusCode: 200, body: JSON.stringify({user, file})}
        }
      }
    `
    const sourceFile = createSourceFile(code)
    const violations = databasePermissionsRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')
    expect(violations).toHaveLength(1)
    expect(violations[0].message).toContain('missing permissions for tables')
    expect(violations[0].message).toContain('files')
  })

  it('should correctly apply to Lambda handler files', () => {
    expect(databasePermissionsRule.appliesTo).toContain('src/lambdas/*/src/index.ts')
  })
})
