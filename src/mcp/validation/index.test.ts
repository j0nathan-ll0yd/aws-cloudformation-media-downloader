/**
 * Unit tests for validation index module
 * Tests the unified validation interface
 */

import {beforeAll, describe, expect, test} from 'vitest'
import {join} from 'path'

// Module loaded via dynamic import
let validateFile: typeof import('./index').validateFile
let validateFiles: typeof import('./index').validateFiles
let getValidationSummary: typeof import('./index').getValidationSummary
let allRules: typeof import('./index').allRules
let rulesByName: typeof import('./index').rulesByName
let awsSdkEncapsulationRule: typeof import('./index').awsSdkEncapsulationRule

const fixturesDir = join(process.cwd(), 'src/mcp/test/fixtures')

beforeAll(async () => {
  const module = await import('./index')
  validateFile = module.validateFile
  validateFiles = module.validateFiles
  getValidationSummary = module.getValidationSummary
  allRules = module.allRules
  rulesByName = module.rulesByName
  awsSdkEncapsulationRule = module.awsSdkEncapsulationRule
})

describe('validation exports', () => {
  describe('allRules', () => {
    test('should export array of rules', () => {
      expect(Array.isArray(allRules)).toBe(true)
      expect(allRules.length).toBe(28)
    })

    test('should contain all expected rules', () => {
      const ruleNames = allRules.map((r) => r.name)
      // CRITICAL rules
      expect(ruleNames).toContain('aws-sdk-encapsulation')
      expect(ruleNames).toContain('drizzle-orm-encapsulation')
      expect(ruleNames).toContain('entity-mocking')
      expect(ruleNames).toContain('config-enforcement')
      expect(ruleNames).toContain('env-validation')
      expect(ruleNames).toContain('cascade-safety')
      // HIGH rules
      expect(ruleNames).toContain('response-helpers')
      expect(ruleNames).toContain('types-location')
      expect(ruleNames).toContain('batch-retry')
      expect(ruleNames).toContain('scan-pagination')
      expect(ruleNames).toContain('doc-sync')
      expect(ruleNames).toContain('secret-permissions')
      expect(ruleNames).toContain('service-permissions')
      expect(ruleNames).toContain('eventbridge-permissions')
      expect(ruleNames).toContain('vendor-decorator-coverage')
      expect(ruleNames).toContain('permission-gap-detection')
      expect(ruleNames).toContain('comment-conventions')
      // MEDIUM rules
      expect(ruleNames).toContain('import-order')
      expect(ruleNames).toContain('response-enum')
      expect(ruleNames).toContain('mock-formatting')
      // HIGH (naming) rules
      expect(ruleNames).toContain('naming-conventions')
      // HIGH (auth) rules
      expect(ruleNames).toContain('authenticated-handler-enforcement')
      // HIGH (docs structure) rules
      expect(ruleNames).toContain('docs-structure')
      // MEDIUM (metrics) rules
      expect(ruleNames).toContain('powertools-metrics')
      // MEDIUM (observability) rules
      expect(ruleNames).toContain('logging-conventions')
    })
  })

  describe('rulesByName', () => {
    test('should have all rules by name', () => {
      // CRITICAL rules
      expect(rulesByName['aws-sdk-encapsulation']).toBeDefined()
      expect(rulesByName['drizzle-orm-encapsulation']).toBeDefined()
      expect(rulesByName['entity-mocking']).toBeDefined()
      expect(rulesByName['config-enforcement']).toBeDefined()
      expect(rulesByName['env-validation']).toBeDefined()
      expect(rulesByName['cascade-safety']).toBeDefined()
      // HIGH rules
      expect(rulesByName['response-helpers']).toBeDefined()
      expect(rulesByName['types-location']).toBeDefined()
      expect(rulesByName['batch-retry']).toBeDefined()
      expect(rulesByName['scan-pagination']).toBeDefined()
      expect(rulesByName['doc-sync']).toBeDefined()
      expect(rulesByName['secret-permissions']).toBeDefined()
      expect(rulesByName['service-permissions']).toBeDefined()
      expect(rulesByName['eventbridge-permissions']).toBeDefined()
      expect(rulesByName['vendor-decorator-coverage']).toBeDefined()
      expect(rulesByName['permission-gap-detection']).toBeDefined()
      expect(rulesByName['comment-conventions']).toBeDefined()
      expect(rulesByName['naming-conventions']).toBeDefined()
      expect(rulesByName['authenticated-handler-enforcement']).toBeDefined()
      // MEDIUM rules
      expect(rulesByName['import-order']).toBeDefined()
      expect(rulesByName['response-enum']).toBeDefined()
      expect(rulesByName['mock-formatting']).toBeDefined()
      // HIGH (docs structure) rules
      expect(rulesByName['docs-structure']).toBeDefined()
      // MEDIUM (metrics) rules
      expect(rulesByName['powertools-metrics']).toBeDefined()
      // MEDIUM (observability) rules
      expect(rulesByName['logging-conventions']).toBeDefined()
    })

    test('should have aliases', () => {
      // CRITICAL aliases
      expect(rulesByName['aws-sdk']).toBe(rulesByName['aws-sdk-encapsulation'])
      expect(rulesByName['drizzle']).toBe(rulesByName['drizzle-orm-encapsulation'])
      expect(rulesByName['drizzle-orm']).toBe(rulesByName['drizzle-orm-encapsulation'])
      expect(rulesByName['entity']).toBe(rulesByName['entity-mocking'])
      expect(rulesByName['config']).toBe(rulesByName['config-enforcement'])
      expect(rulesByName['env']).toBe(rulesByName['env-validation'])
      expect(rulesByName['cascade']).toBe(rulesByName['cascade-safety'])
      // HIGH aliases
      expect(rulesByName['response']).toBe(rulesByName['response-helpers'])
      expect(rulesByName['types']).toBe(rulesByName['types-location'])
      expect(rulesByName['batch']).toBe(rulesByName['batch-retry'])
      expect(rulesByName['scan']).toBe(rulesByName['scan-pagination'])
      expect(rulesByName['docs']).toBe(rulesByName['doc-sync'])
      expect(rulesByName['secrets']).toBe(rulesByName['secret-permissions'])
      expect(rulesByName['services']).toBe(rulesByName['service-permissions'])
      expect(rulesByName['eventbridge']).toBe(rulesByName['eventbridge-permissions'])
      expect(rulesByName['events']).toBe(rulesByName['eventbridge-permissions'])
      expect(rulesByName['vendor-decorators']).toBe(rulesByName['vendor-decorator-coverage'])
      expect(rulesByName['permission-gap']).toBe(rulesByName['permission-gap-detection'])
      expect(rulesByName['comments']).toBe(rulesByName['comment-conventions'])
      // MEDIUM aliases
      expect(rulesByName['imports']).toBe(rulesByName['import-order'])
      expect(rulesByName['enum']).toBe(rulesByName['response-enum'])
      expect(rulesByName['mock']).toBe(rulesByName['mock-formatting'])
      // HIGH (naming) aliases
      expect(rulesByName['naming']).toBe(rulesByName['naming-conventions'])
      // HIGH (auth) aliases
      expect(rulesByName['auth']).toBe(rulesByName['authenticated-handler-enforcement'])
      // HIGH (docs structure) aliases
      expect(rulesByName['docs-location']).toBe(rulesByName['docs-structure'])
      // MEDIUM (metrics) aliases
      expect(rulesByName['metrics']).toBe(rulesByName['powertools-metrics'])
      // MEDIUM (observability) aliases
      expect(rulesByName['logging']).toBe(rulesByName['logging-conventions'])
    })
  })

  describe('individual rule exports', () => {
    test('should export awsSdkEncapsulationRule', () => {
      expect(awsSdkEncapsulationRule).toBeDefined()
      expect(awsSdkEncapsulationRule.name).toBe('aws-sdk-encapsulation')
    })
  })
})

describe('validateFile', () => {
  test('should validate a valid handler file', async () => {
    const result = await validateFile(join(fixturesDir, 'valid/aws-sdk-vendor-wrapper.fixture.ts'), {projectRoot: process.cwd()})

    // File path should be relative
    expect(result.file).toContain('valid/aws-sdk-vendor-wrapper.fixture.ts')
    // Should have no critical violations for valid code
    // Note: Some rules may skip this file if it's not in the right location
    expect(result.skipped.length + result.passed.length).toBeGreaterThan(0)
  })

  test('should detect AWS SDK violation', async () => {
    const result = await validateFile(join(fixturesDir, 'invalid/aws-sdk-direct-dynamodb.fixture.ts'), {projectRoot: process.cwd()})

    // Should find the AWS SDK violation
    const awsViolations = result.violations.filter((v) => v.rule === 'aws-sdk-encapsulation')
    expect(awsViolations.length).toBeGreaterThan(0)
    expect(awsViolations[0].severity).toBe('CRITICAL')
    expect(result.valid).toBe(false)
  })

  test('should handle non-existent file gracefully', async () => {
    const result = await validateFile('/path/to/nonexistent.ts')

    expect(result.valid).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].rule).toBe('file-parse')
  })

  test('should run specific rules when specified', async () => {
    const result = await validateFile(join(fixturesDir, 'invalid/aws-sdk-direct-dynamodb.fixture.ts'), {
      projectRoot: process.cwd(),
      rules: ['aws-sdk-encapsulation']
    })

    // Only the specified rule should run (others skipped)
    const nonAwsViolations = result.violations.filter((v) => v.rule !== 'aws-sdk-encapsulation' && v.rule !== 'file-parse')
    expect(nonAwsViolations).toHaveLength(0)
  })

  test('should skip rules that dont apply', async () => {
    const result = await validateFile(join(fixturesDir, 'valid/aws-sdk-vendor-wrapper.fixture.ts'), {projectRoot: process.cwd()})

    // Some rules should be skipped (file not in right location)
    expect(result.skipped.length).toBeGreaterThan(0)
  })

  test('should track passed rules', async () => {
    const result = await validateFile(join(fixturesDir, 'valid/aws-sdk-vendor-wrapper.fixture.ts'), {projectRoot: process.cwd()})

    // Some rules should pass
    expect(result.passed.length + result.skipped.length).toBeGreaterThan(0)
  })
})

describe('validateFiles', () => {
  test('should validate multiple files', async () => {
    const results = await validateFiles([
      join(fixturesDir, 'valid/aws-sdk-vendor-wrapper.fixture.ts'),
      join(fixturesDir, 'invalid/aws-sdk-direct-dynamodb.fixture.ts')
    ], {projectRoot: process.cwd()})

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.file)).toBe(true)
  })

  test('should return results in same order as input', async () => {
    const results = await validateFiles([
      join(fixturesDir, 'invalid/aws-sdk-direct-dynamodb.fixture.ts'),
      join(fixturesDir, 'valid/aws-sdk-vendor-wrapper.fixture.ts')
    ], {projectRoot: process.cwd()})

    expect(results[0].file).toContain('invalid/aws-sdk-direct-dynamodb.fixture.ts')
    expect(results[1].file).toContain('valid/aws-sdk-vendor-wrapper.fixture.ts')
  })

  test('should handle empty array', async () => {
    const results = await validateFiles([])

    expect(results).toHaveLength(0)
  })
})

describe('getValidationSummary', () => {
  test('should compute correct totals', async () => {
    const results = await validateFiles([
      join(fixturesDir, 'valid/aws-sdk-vendor-wrapper.fixture.ts'),
      join(fixturesDir, 'invalid/aws-sdk-direct-dynamodb.fixture.ts')
    ], {projectRoot: process.cwd()})

    const summary = getValidationSummary(results)

    expect(summary.totalFiles).toBe(2)
    expect(summary.validFiles + summary.invalidFiles).toBe(2)
    // Invalid file should have at least one violation
    expect(summary.invalidFiles).toBeGreaterThanOrEqual(1)
  })

  test('should count violations by severity', async () => {
    const results = await validateFiles([join(fixturesDir, 'invalid/aws-sdk-direct-dynamodb.fixture.ts')], {projectRoot: process.cwd()})

    const summary = getValidationSummary(results)

    expect(summary.violationsBySeverity).toBeDefined()
    // AWS SDK violation is CRITICAL
    expect(summary.violationsBySeverity['CRITICAL']).toBeGreaterThan(0)
  })

  test('should count violations by rule', async () => {
    const results = await validateFiles([join(fixturesDir, 'invalid/aws-sdk-direct-dynamodb.fixture.ts')], {projectRoot: process.cwd()})

    const summary = getValidationSummary(results)

    expect(summary.violationsByRule).toBeDefined()
    expect(summary.violationsByRule['aws-sdk-encapsulation']).toBeGreaterThan(0)
  })

  test('should handle empty results', () => {
    const summary = getValidationSummary([])

    expect(summary.totalFiles).toBe(0)
    expect(summary.validFiles).toBe(0)
    expect(summary.invalidFiles).toBe(0)
    expect(summary.totalViolations).toBe(0)
  })

  test('should handle results with no violations', async () => {
    // Create a mock valid result
    const mockResults = [
      {file: 'test.ts', valid: true, violations: [], passed: ['rule1'], skipped: []}
    ]

    const summary = getValidationSummary(mockResults)

    expect(summary.totalFiles).toBe(1)
    expect(summary.validFiles).toBe(1)
    expect(summary.invalidFiles).toBe(0)
    expect(summary.totalViolations).toBe(0)
  })
})

describe('rule applicability', () => {
  test('should apply aws-sdk rule to src/**/*.ts files', async () => {
    // The invalid-aws-sdk fixture is in a non-standard path but still a .ts file
    const result = await validateFile(join(fixturesDir, 'invalid/aws-sdk-direct-dynamodb.fixture.ts'), {
      projectRoot: process.cwd(),
      rules: ['aws-sdk-encapsulation']
    })

    // Rule should apply (not skipped) for .ts files in src/
    const applied = !result.skipped.includes('aws-sdk-encapsulation')
    expect(applied).toBe(true)
  })

  test('should skip rules for excluded paths', async () => {
    // Test file should be skipped by response-helpers rule
    const result = await validateFile(join(fixturesDir, 'valid/aws-sdk-vendor-wrapper.fixture.ts'), {
      projectRoot: process.cwd(),
      rules: ['response-helpers']
    })

    // response-helpers only applies to src/lambdas/**/src/index.ts
    expect(result.skipped).toContain('response-helpers')
  })
})

describe('edge cases', () => {
  test('should handle relative file paths', async () => {
    const relativePath = 'src/mcp/test/fixtures/valid/aws-sdk-vendor-wrapper.fixture.ts'
    const result = await validateFile(relativePath, {projectRoot: process.cwd()})

    expect(result.file).toBe(relativePath)
  })

  test('should handle unknown rule names gracefully', async () => {
    const result = await validateFile(join(fixturesDir, 'valid/aws-sdk-vendor-wrapper.fixture.ts'), {
      projectRoot: process.cwd(),
      rules: ['nonexistent-rule']
    })

    // Should not crash, just no rules run
    expect(result).toBeDefined()
    expect(result.violations).toHaveLength(0)
  })
})
