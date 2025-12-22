/**
 * Unit tests for authenticated-handler-enforcement rule
 * HIGH: Use wrapAuthenticatedHandler/wrapOptionalAuthHandler instead of manual auth checks
 */

import {beforeAll, describe, expect, test} from '@jest/globals'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let authenticatedHandlerEnforcementRule: typeof import('./authenticated-handler-enforcement').authenticatedHandlerEnforcementRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./authenticated-handler-enforcement')
  authenticatedHandlerEnforcementRule = module.authenticatedHandlerEnforcementRule
})

describe('authenticated-handler-enforcement rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(authenticatedHandlerEnforcementRule.name).toBe('authenticated-handler-enforcement')
    })

    test('should have HIGH severity', () => {
      expect(authenticatedHandlerEnforcementRule.severity).toBe('HIGH')
    })

    test('should apply to Lambda handler files', () => {
      expect(authenticatedHandlerEnforcementRule.appliesTo).toContain('src/lambdas/**/src/index.ts')
    })

    test('should exclude test files', () => {
      expect(authenticatedHandlerEnforcementRule.excludes).toContain('src/**/*.test.ts')
    })
  })

  describe('detects manual auth handling', () => {
    test('should detect getUserDetailsFromEvent call', () => {
      const sourceFile = project.createSourceFile('test-manual-auth.ts', `
import {getUserDetailsFromEvent} from '#util/apigateway-helpers'
import {wrapApiHandler} from '#util/lambda-helpers'

export const handler = wrapApiHandler(async ({event, context}) => {
  const {userId, userStatus} = getUserDetailsFromEvent(event)
  if (!userId) {
    throw new Error('Unauthorized')
  }
  return response(context, 200, {})
})
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('HIGH')
      expect(violations[0].message).toContain('Manual auth handling detected')
    })

    test('should detect getUserDetailsFromEvent with UserStatus.Unauthenticated check', () => {
      const sourceFile = project.createSourceFile('test-unauthenticated-check.ts', `
import {getUserDetailsFromEvent} from '#util/apigateway-helpers'
import {UserStatus} from '#types/enums'

export const handler = wrapApiHandler(async ({event}) => {
  const {userId, userStatus} = getUserDetailsFromEvent(event)
  if (userStatus === UserStatus.Unauthenticated) {
    throw new UnauthorizedError()
  }
  return response(context, 200, {})
})
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].suggestion).toContain('wrapOptionalAuthHandler')
    })

    test('should detect getUserDetailsFromEvent with both Anonymous and Unauthenticated checks', () => {
      const sourceFile = project.createSourceFile('test-both-checks.ts', `
import {getUserDetailsFromEvent} from '#util/apigateway-helpers'
import {UserStatus} from '#types/enums'

export const handler = wrapApiHandler(async ({event}) => {
  const {userId, userStatus} = getUserDetailsFromEvent(event)
  if (userStatus === UserStatus.Unauthenticated) {
    throw new UnauthorizedError()
  }
  if (userStatus === UserStatus.Anonymous) {
    throw new UnauthorizedError()
  }
  return response(context, 200, {})
})
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].suggestion).toContain('wrapAuthenticatedHandler')
    })
  })

  describe('allows valid patterns', () => {
    test('should allow wrapAuthenticatedHandler usage', () => {
      const sourceFile = project.createSourceFile('test-authenticated-wrapper.ts', `
import {wrapAuthenticatedHandler} from '#util/lambda-helpers'
import type {AuthenticatedApiParams} from '#types/lambda'

export const handler = wrapAuthenticatedHandler(async ({context, userId}: AuthenticatedApiParams) => {
  // userId is guaranteed to be a string
  await deleteUser(userId)
  return response(context, 204)
})
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow wrapOptionalAuthHandler usage', () => {
      const sourceFile = project.createSourceFile('test-optional-wrapper.ts', `
import {wrapOptionalAuthHandler} from '#util/lambda-helpers'
import type {OptionalAuthApiParams} from '#types/lambda'
import {UserStatus} from '#types/enums'

export const handler = wrapOptionalAuthHandler(async ({context, userId, userStatus}: OptionalAuthApiParams) => {
  if (userStatus === UserStatus.Anonymous) {
    return response(context, 200, {demo: true})
  }
  return response(context, 200, {userId})
})
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })

    test('should allow public endpoints without auth', () => {
      const sourceFile = project.createSourceFile('test-public.ts', `
import {wrapApiHandler} from '#util/lambda-helpers'

export const handler = wrapApiHandler(async ({event, context}) => {
  // Public endpoint - no auth needed
  return response(context, 200, {status: 'ok'})
})
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('detects redundant getUserDetailsFromEvent', () => {
    test('should flag redundant getUserDetailsFromEvent when using new wrapper', () => {
      const sourceFile = project.createSourceFile('test-redundant.ts', `
import {getUserDetailsFromEvent} from '#util/apigateway-helpers'
import {wrapAuthenticatedHandler} from '#util/lambda-helpers'

export const handler = wrapAuthenticatedHandler(async ({event, context, userId}) => {
  // This is redundant - userId is already in params
  const {userId: uid} = getUserDetailsFromEvent(event)
  return response(context, 200, {userId: uid})
})
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations).toHaveLength(1)
      expect(violations[0].message).toContain('Redundant getUserDetailsFromEvent')
    })
  })

  describe('skips non-Lambda files', () => {
    test('should skip utility files', () => {
      const sourceFile = project.createSourceFile('test-util.ts', `
import {getUserDetailsFromEvent} from '#util/apigateway-helpers'
// This is allowed in utility files
export function helper(event) {
  return getUserDetailsFromEvent(event)
}
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/util/helpers.ts')

      expect(violations).toHaveLength(0)
    })

    test('should skip files not matching Lambda pattern', () => {
      const sourceFile = project.createSourceFile('test-other.ts', `
import {getUserDetailsFromEvent} from '#util/apigateway-helpers'
const x = getUserDetailsFromEvent(event)
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/lib/auth.ts')

      expect(violations).toHaveLength(0)
    })
  })

  describe('provides helpful suggestions', () => {
    test('should suggest wrapAuthenticatedHandler for full auth', () => {
      const sourceFile = project.createSourceFile('test-suggest-auth.ts', `
import {getUserDetailsFromEvent} from '#util/apigateway-helpers'
import {UserStatus} from '#types/enums'

export const handler = wrapApiHandler(async ({event}) => {
  const {userStatus} = getUserDetailsFromEvent(event)
  if (userStatus === UserStatus.Unauthenticated || userStatus === UserStatus.Anonymous) {
    throw new Error('Unauthorized')
  }
})
`, {overwrite: true})

      const violations = authenticatedHandlerEnforcementRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')

      expect(violations[0].suggestion).toContain('wrapAuthenticatedHandler')
    })
  })
})
