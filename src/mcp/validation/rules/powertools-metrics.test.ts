/**
 * Unit tests for powertools-metrics rule
 * MEDIUM: Validate PowerTools metrics usage patterns
 */

import {beforeAll, describe, expect, test} from 'vitest'
import type {ValidationRule} from '../types'
import {loadFixture} from '../../test/fixtures'

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
    test('passes when no metrics are used', () => {
      const {sourceFile, metadata} = loadFixture('valid/powertools-no-metrics')
      const violations = powertoolsMetricsRule.validate(sourceFile, metadata.simulatedPath!)
      expect(violations).toHaveLength(0)
    })

    test('passes when metrics.addMetric and enableCustomMetrics are both present', () => {
      const {sourceFile, metadata} = loadFixture('valid/powertools-with-custom-metrics')
      const violations = powertoolsMetricsRule.validate(sourceFile, metadata.simulatedPath!)
      expect(violations).toHaveLength(0)
    })

    test('fails when metrics.addMetric is used without enableCustomMetrics', () => {
      const {sourceFile, metadata} = loadFixture('invalid/powertools-missing-enable')
      const violations = powertoolsMetricsRule.validate(sourceFile, metadata.simulatedPath!)
      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0].message).toContain('enableCustomMetrics')
    })
  })

  describe('singleMetric validation', () => {
    test('passes when singleMetric is used with addDimension', () => {
      const {sourceFile, metadata} = loadFixture('valid/powertools-single-metric')
      const violations = powertoolsMetricsRule.validate(sourceFile, metadata.simulatedPath!)
      // Should have no violations about singleMetric usage
      const singleMetricViolations = violations.filter((v) => v.message.includes('singleMetric'))
      expect(singleMetricViolations).toHaveLength(0)
    })

    test('warns when addDimension is used without singleMetric', () => {
      const {sourceFile, metadata} = loadFixture('invalid/powertools-dimension-without-single')
      const violations = powertoolsMetricsRule.validate(sourceFile, metadata.simulatedPath!)
      const singleMetricViolations = violations.filter((v) => v.message.includes('singleMetric'))
      expect(singleMetricViolations.length).toBeGreaterThanOrEqual(1)
    })
  })
})
