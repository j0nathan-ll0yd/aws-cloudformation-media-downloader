import {beforeAll, describe, expect, test} from '@jest/globals'
import type {ValidationRule} from '../types'

describe('powertools-metrics rule', () => {
  let powertoolsMetricsRule: ValidationRule

  beforeAll(async () => {
    const module = await import('./powertools-metrics')
    powertoolsMetricsRule = module.powertoolsMetricsRule
  })

  describe('rule metadata', () => {
    test('has correct name', () => {
      expect(powertoolsMetricsRule.name).toBe('powertools-metrics')
    })

    test('has MEDIUM severity', () => {
      expect(powertoolsMetricsRule.severity).toBe('MEDIUM')
    })

    test('applies to Lambda src files', () => {
      expect(powertoolsMetricsRule.appliesTo).toContain('src/lambdas/*/src/**/*.ts')
    })

    test('excludes test and fixture files', () => {
      expect(powertoolsMetricsRule.excludes).toContain('**/*.test.ts')
      expect(powertoolsMetricsRule.excludes).toContain('**/*.fixture.ts')
    })
  })

  describe('enableCustomMetrics validation', () => {
    test('passes when no metrics are used', async () => {
      const {Project} = await import('ts-morph')
      const project = new Project({useInMemoryFileSystem: true})
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export const handler = withPowertools(async () => {
          return {statusCode: 200}
        })
        `
      )
      const violations = powertoolsMetricsRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')
      expect(violations).toHaveLength(0)
    })

    test('passes when metrics.addMetric and enableCustomMetrics are both present', async () => {
      const {Project} = await import('ts-morph')
      const project = new Project({useInMemoryFileSystem: true})
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export const handler = withPowertools(async () => {
          metrics.addMetric('Count', MetricUnit.Count, 1)
          return {statusCode: 200}
        }, {enableCustomMetrics: true})
        `
      )
      const violations = powertoolsMetricsRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')
      expect(violations).toHaveLength(0)
    })

    test('fails when metrics.addMetric is used without enableCustomMetrics', async () => {
      const {Project} = await import('ts-morph')
      const project = new Project({useInMemoryFileSystem: true})
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export const handler = withPowertools(async () => {
          metrics.addMetric('Count', MetricUnit.Count, 1)
          return {statusCode: 200}
        })
        `
      )
      const violations = powertoolsMetricsRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')
      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('enableCustomMetrics')
    })
  })

  describe('singleMetric validation', () => {
    test('passes when singleMetric is used with addDimension', async () => {
      const {Project} = await import('ts-morph')
      const project = new Project({useInMemoryFileSystem: true})
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export const handler = withPowertools(async () => {
          const metric = metrics.singleMetric()
          metric.addDimension('Type', 'test')
          metric.addMetric('Count', MetricUnit.Count, 1)
        }, {enableCustomMetrics: true})
        `
      )
      const violations = powertoolsMetricsRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')
      // Should have no violations about singleMetric usage
      const singleMetricViolations = violations.filter((v) => v.message.includes('singleMetric'))
      expect(singleMetricViolations).toHaveLength(0)
    })

    test('warns when addDimension is used without singleMetric', async () => {
      const {Project} = await import('ts-morph')
      const project = new Project({useInMemoryFileSystem: true})
      const sourceFile = project.createSourceFile(
        'test.ts',
        `
        export const handler = withPowertools(async () => {
          metrics.addDimension('Type', 'test')
          metrics.addMetric('Count', MetricUnit.Count, 1)
        }, {enableCustomMetrics: true})
        `
      )
      const violations = powertoolsMetricsRule.validate(sourceFile, 'src/lambdas/Test/src/index.ts')
      const singleMetricViolations = violations.filter((v) => v.message.includes('singleMetric'))
      expect(singleMetricViolations.length).toBeGreaterThanOrEqual(1)
    })
  })
})
