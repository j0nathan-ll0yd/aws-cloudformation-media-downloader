/**
 * Unit tests for comment-conventions rule
 * HIGH: Validates JSDoc presence, file headers, and comment patterns
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let commentConventionsRule: typeof import('./comment-conventions').commentConventionsRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./comment-conventions')
  commentConventionsRule = module.commentConventionsRule
})

describe('comment-conventions rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(commentConventionsRule.name).toBe('comment-conventions')
    })

    test('should have HIGH severity', () => {
      expect(commentConventionsRule.severity).toBe('HIGH')
    })

    test('should apply to Lambda handlers', () => {
      expect(commentConventionsRule.appliesTo).toContain('src/lambdas/**/src/index.ts')
    })

    test('should exclude test files', () => {
      expect(commentConventionsRule.excludes).toContain('**/*.test.ts')
    })
  })

  describe('Lambda file headers', () => {
    test('should detect missing file header', () => {
      const sourceFile = project.createSourceFile('missing-header.ts', `export const handler = async () => { return 'ok' }`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/lambdas/TestLambda/src/index.ts')

      expect(violations.some((v) => v.message.includes('missing file header'))).toBe(true)
    })

    test('should accept valid file header with Trigger section', () => {
      const sourceFile = project.createSourceFile('valid-header.ts', `/**
 * TestLambda Lambda
 *
 * Test handler description.
 *
 * Trigger: API Gateway
 * Input: Event
 * Output: Response
 */

export const handler = async () => { return 'ok' }`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/lambdas/TestLambda/src/index.ts')

      // Should not have file header violations (may have other violations for JSDoc on handler)
      expect(violations.filter((v) => v.message.includes('file header')).length).toBe(0)
    })

    test('should detect file header missing Trigger section', () => {
      const sourceFile = project.createSourceFile('incomplete-header.ts', `/**
 * Just a comment without trigger info
 */

export const handler = async () => { return 'ok' }`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/lambdas/TestLambda/src/index.ts')

      expect(violations.some((v) => v.message.includes('Trigger/Input/Output sections'))).toBe(true)
    })
  })

  describe('exported function JSDoc', () => {
    test('should detect exported function missing JSDoc', () => {
      const sourceFile = project.createSourceFile('no-jsdoc.ts', `export function processData(input: string): string {
  return input.toUpperCase()
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.some((v) => v.message.includes("'processData' missing JSDoc"))).toBe(true)
    })

    test('should accept exported function with JSDoc', () => {
      const sourceFile = project.createSourceFile('has-jsdoc.ts', `/**
 * Process the input data
 * @param input - The input string
 * @returns The processed string
 */
export function processData(input: string): string {
  return input.toUpperCase()
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.filter((v) => v.message.includes("'processData' missing JSDoc")).length).toBe(0)
    })

    test('should detect exported arrow function missing JSDoc', () => {
      const sourceFile = project.createSourceFile('arrow-no-jsdoc.ts', `export const formatDate = (date: Date): string => {
  return date.toISOString()
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/util/format.ts')

      expect(violations.some((v) => v.message.includes("'formatDate' missing JSDoc"))).toBe(true)
    })

    test('should accept exported arrow function with JSDoc', () => {
      const sourceFile = project.createSourceFile('arrow-has-jsdoc.ts', `/**
 * Format a date to ISO string
 * @param date - The date to format
 * @returns ISO date string
 */
export const formatDate = (date: Date): string => {
  return date.toISOString()
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/util/format.ts')

      expect(violations.filter((v) => v.message.includes("'formatDate' missing JSDoc")).length).toBe(0)
    })
  })

  describe('@example tag length', () => {
    test('should detect @example tag over 5 lines', () => {
      const sourceFile = project.createSourceFile('long-example.ts', `/**
 * Process data
 * @example
 * const result = processData('test')
 * console.log(result)
 * const another = processData('more')
 * console.log(another)
 * const third = processData('even more')
 * console.log(third)
 */
export function processData(input: string): string {
  return input
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.some((v) => v.message.includes('@example tag too long'))).toBe(true)
    })

    test('should accept @example tag 5 lines or less', () => {
      const sourceFile = project.createSourceFile('short-example.ts', `/**
 * Process data
 * @example
 * const result = processData('test')
 * console.log(result)
 */
export function processData(input: string): string {
  return input
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.filter((v) => v.message.includes('@example tag too long')).length).toBe(0)
    })
  })

  describe('type documentation', () => {
    test('should detect exported interface missing JSDoc in type files', () => {
      const sourceFile = project.createSourceFile('interface-no-jsdoc.ts', `export interface UserData {
  name: string
  email: string
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/types/domain.ts')

      expect(violations.some((v) => v.message.includes("interface 'UserData' missing JSDoc"))).toBe(true)
    })

    test('should accept exported interface with JSDoc in type files', () => {
      const sourceFile = project.createSourceFile('interface-has-jsdoc.ts', `/** User data for the application */
export interface UserData {
  name: string
  email: string
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/types/domain.ts')

      expect(violations.filter((v) => v.message.includes("interface 'UserData' missing JSDoc")).length).toBe(0)
    })

    test('should detect exported type alias missing JSDoc in type files', () => {
      const sourceFile = project.createSourceFile('type-no-jsdoc.ts', `export type UserId = string`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/types/domain.ts')

      expect(violations.some((v) => v.message.includes("type alias 'UserId' missing JSDoc"))).toBe(true)
    })
  })

  describe('@param hyphen format', () => {
    test('should detect @param without hyphen before description', () => {
      const sourceFile = project.createSourceFile('param-no-hyphen.ts', `/**
 * Process user data
 * @param userId The user identifier
 * @returns The processed data
 */
export function processUser(userId: string): string {
  return userId
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.some((v) => v.message.includes("'userId' missing hyphen before description"))).toBe(true)
    })

    test('should accept @param with hyphen format', () => {
      const sourceFile = project.createSourceFile('param-hyphen.ts', `/**
 * Process user data
 * @param userId - The user identifier
 * @returns The processed data
 */
export function processUser(userId: string): string {
  return userId
}`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.filter((v) => v.message.includes("'userId' missing hyphen")).length).toBe(0)
    })
  })

  describe('non-lambda files', () => {
    test('should not require file headers for non-lambda files', () => {
      const sourceFile = project.createSourceFile('util-file.ts', `export function helperFn(): void { }`, {overwrite: true})

      const violations = commentConventionsRule.validate(sourceFile, 'src/util/helpers.ts')

      // May have violations for JSDoc, but not for file header
      expect(violations.filter((v) => v.message.includes('file header')).length).toBe(0)
    })
  })
})
