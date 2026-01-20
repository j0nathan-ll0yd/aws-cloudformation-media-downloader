/**
 * Unit tests for logging-conventions rule
 * MEDIUM: Validates consistent logging message patterns
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {Project} from 'ts-morph'

// Module loaded via dynamic import
let loggingConventionsRule: typeof import('./logging-conventions').loggingConventionsRule

// Create ts-morph project for in-memory source files
const project = new Project({skipFileDependencyResolution: true, skipAddingFilesFromTsConfig: true})

beforeAll(async () => {
  const module = await import('./logging-conventions')
  loggingConventionsRule = module.loggingConventionsRule
})

describe('logging-conventions rule', () => {
  describe('rule metadata', () => {
    test('should have correct name', () => {
      expect(loggingConventionsRule.name).toBe('logging-conventions')
    })

    test('should have MEDIUM severity', () => {
      expect(loggingConventionsRule.severity).toBe('MEDIUM')
    })

    test('should apply to Lambda handlers', () => {
      expect(loggingConventionsRule.appliesTo).toContain('src/lambdas/**/src/index.ts')
    })

    test('should apply to lib files', () => {
      expect(loggingConventionsRule.appliesTo).toContain('src/lib/**/*.ts')
    })

    test('should exclude test files', () => {
      expect(loggingConventionsRule.excludes).toContain('**/*.test.ts')
    })

    test('should exclude MCP files', () => {
      expect(loggingConventionsRule.excludes).toContain('src/mcp/**/*.ts')
    })
  })

  describe('response == pattern detection', () => {
    test('should detect response == pattern and suggest =>', () => {
      const sourceFile = project.createSourceFile('response-double-equals.ts', `import {logDebug} from '#lib/system/logging'
logDebug('response ==', result)`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lib/lambda/responses.ts')

      expect(violations.length).toBe(1)
      expect(violations[0].message).toContain("'response =>'")
      expect(violations[0].message).toContain("'response =='")
    })

    test('should detect response == with extra spaces', () => {
      const sourceFile = project.createSourceFile('response-spaced.ts', `import {logDebug} from '#lib/system/logging'
logDebug('response  ==', result)`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lib/lambda/responses.ts')

      expect(violations.length).toBe(1)
      expect(violations[0].message).toContain("'response =>'")
    })

    test('should accept response => pattern', () => {
      const sourceFile = project.createSourceFile('response-arrow.ts', `import {logDebug} from '#lib/system/logging'
logDebug('response =>', result)`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lib/lambda/responses.ts')

      expect(violations.length).toBe(0)
    })
  })

  describe('valid entry/exit patterns', () => {
    test('should accept functionName <= pattern', () => {
      const sourceFile = project.createSourceFile('valid-entry.ts', `import {logDebug} from '#lib/system/logging'
logDebug('getUserById <=', {userId})`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lambdas/ListFiles/src/index.ts')

      expect(violations.length).toBe(0)
    })

    test('should accept functionName => pattern', () => {
      const sourceFile = project.createSourceFile('valid-exit.ts', `import {logDebug} from '#lib/system/logging'
logDebug('getUserById =>', user)`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lambdas/ListFiles/src/index.ts')

      expect(violations.length).toBe(0)
    })

    test('should accept request <= pattern', () => {
      const sourceFile = project.createSourceFile('valid-request.ts', `import {logInfo} from '#lib/system/logging'
logInfo('request <=', getRequestSummary(event))`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lambdas/ListFiles/src/index.ts')

      expect(violations.length).toBe(0)
    })
  })

  describe('dotted message pattern detection', () => {
    test('should detect dotted message patterns', () => {
      const sourceFile = project.createSourceFile('dotted-pattern.ts', `import {logDebug} from '#lib/system/logging'
logDebug('getPayloadFromEvent.event.body <=', body)`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.length).toBe(1)
      expect(violations[0].message).toContain('dotted message patterns')
      expect(violations[0].suggestion).toContain('camelCase function name')
    })

    test('should detect simple two-part dotted patterns', () => {
      const sourceFile = project.createSourceFile('simple-dotted.ts', `import {logDebug} from '#lib/system/logging'
logDebug('func.nested <=', data)`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.length).toBe(1)
      expect(violations[0].message).toContain('dotted message patterns')
    })
  })

  describe('business event logging', () => {
    test('should accept plain English info messages', () => {
      const sourceFile = project.createSourceFile('business-event.ts', `import {logInfo} from '#lib/system/logging'
logInfo('Sending push notification', {deviceId, type: 'download_ready'})`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lambdas/SendPushNotification/src/index.ts')

      expect(violations.length).toBe(0)
    })

    test('should accept phase logging', () => {
      const sourceFile = project.createSourceFile('phase-logging.ts', `import {logInfo} from '#lib/system/logging'
logInfo('Phase 1: Downloading to temp file', {url})
logInfo('Phase 1 complete: Download finished', {size})`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lambdas/StartFileUpload/src/index.ts')

      expect(violations.length).toBe(0)
    })
  })

  describe('error logging', () => {
    test('should accept descriptive error messages', () => {
      const sourceFile = project.createSourceFile('error-logging.ts', `import {logError} from '#lib/system/logging'
logError('Failed to process message', {messageId, error: message})`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lambdas/SendPushNotification/src/index.ts')

      expect(violations.length).toBe(0)
    })
  })

  describe('non-logging calls', () => {
    test('should ignore console.log calls', () => {
      const sourceFile = project.createSourceFile('console-log.ts', `console.log('response ==', result)`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.length).toBe(0)
    })

    test('should ignore other function calls', () => {
      const sourceFile = project.createSourceFile('other-calls.ts', `someFunction('response ==', result)`, {overwrite: true})

      const violations = loggingConventionsRule.validate(sourceFile, 'src/lib/util/helpers.ts')

      expect(violations.length).toBe(0)
    })
  })
})
