/**
 * PowerTools Metrics Rule
 * MEDIUM: Validates correct usage of PowerTools metrics
 *
 * This rule validates that:
 * 1. Files using metrics.addMetric() have {enableCustomMetrics: true} in withPowertools()
 * 2. Warns when addDimension() is used without singleMetric()
 *
 * @see docs/wiki/TypeScript/Lambda-Function-Patterns.md
 */

import type {SourceFile} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'powertools-metrics'
const SEVERITY = 'MEDIUM' as const

export const powertoolsMetricsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Validates correct usage of PowerTools metrics including enableCustomMetrics flag',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/*/src/**/*.ts'],
  excludes: ['**/*.test.ts', '**/*.fixture.ts'],

  validate(sourceFile: SourceFile, _filePath: string): Violation[] {
    void _filePath
    const violations: Violation[] = []
    const text = sourceFile.getFullText()

    // Check if file uses metrics.addMetric
    const usesAddMetric = /metrics\.addMetric\s*\(/.test(text)
    const usesSingleMetric = /metrics\.singleMetric\s*\(/.test(text)
    const usesWithPowertools = /withPowertools\s*\(/.test(text)

    if (!usesAddMetric && !usesSingleMetric) {
      // No metrics usage, skip validation
      return violations
    }

    // Check if enableCustomMetrics is set
    const hasEnableCustomMetrics = /enableCustomMetrics\s*:\s*true/.test(text)

    if (usesAddMetric && usesWithPowertools && !hasEnableCustomMetrics) {
      // Find the line where withPowertools is called
      const withPowertoolsMatch = text.match(/withPowertools\s*\(/)
      const lineNumber = withPowertoolsMatch
        ? text.substring(0, withPowertoolsMatch.index).split('\n').length
        : 1

      violations.push(
        createViolation(
          RULE_NAME,
          'HIGH',
          lineNumber,
          'Lambda uses metrics.addMetric() but withPowertools() is missing {enableCustomMetrics: true}',
          {
            suggestion: 'Add {enableCustomMetrics: true} as the second argument to withPowertools()',
            codeSnippet: 'withPowertools(handler, {enableCustomMetrics: true})'
          }
        )
      )
    }

    // Check for addDimension without singleMetric pattern
    // This is a common mistake - adding dimensions to the shared metrics object
    // instead of using singleMetric() which creates an isolated metrics object
    const addDimensionMatches = text.matchAll(/metrics\.addDimension\s*\(/g)
    for (const match of addDimensionMatches) {
      const lineNumber = text.substring(0, match.index).split('\n').length

      // Check if there's a singleMetric() call nearby (within ~10 lines before)
      const beforeContext = text.substring(Math.max(0, (match.index ?? 0) - 500), match.index)
      if (!beforeContext.includes('singleMetric()')) {
        violations.push(
          createViolation(
            RULE_NAME,
            SEVERITY,
            lineNumber,
            'metrics.addDimension() used without singleMetric() - dimensions will persist across all metrics',
            {
              suggestion: 'Use metrics.singleMetric().addDimension() to create isolated metrics with unique dimensions',
              codeSnippet: 'const metric = metrics.singleMetric()\nmetric.addDimension("Type", value)\nmetric.addMetric("Count", MetricUnit.Count, 1)'
            }
          )
        )
      }
    }

    return violations
  }
}
