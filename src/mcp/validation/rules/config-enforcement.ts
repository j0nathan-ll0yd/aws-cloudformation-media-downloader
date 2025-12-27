/**
 * Config Enforcement Rule
 * CRITICAL: Detects configuration changes that weaken enforcement standards
 *
 * This rule validates configuration files to ensure they don't introduce
 * patterns that violate project conventions documented in AGENTS.md:
 * - "Avoid backwards-compatibility hacks like renaming unused _vars"
 *
 * @see docs/wiki/Meta/Conventions-Tracking.md
 */

import type {SourceFile} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'config-enforcement'
const SEVERITY = 'CRITICAL' as const

/**
 * Allowed ESLint ignores - anything not in this list triggers a HIGH severity warning
 */
const ALLOWED_ESLINT_IGNORES = [
  '**/node_modules',
  '**/dist',
  '**/docs',
  '**/secure',
  '**/static',
  '**/temp',
  '**/terraform',
  '**/coverage',
  '**/coverage-reports',
  '**/build',
  '**/bin',
  '**/.github',
  '**/.idea',
  '**/.webpackCache',
  'src/types/terraform.d.ts',
  'src/types/infrastructure.d.ts',
  'eslint.config.mjs',
  '.dependency-cruiser.cjs',
  'src/mcp/test/fixtures/**/*',
  '**/*.fixture.ts',
  'eslint-local-rules/**/*'
]

/**
 * TSConfig strict mode settings that should never be disabled
 */
const STRICT_TSCONFIG_SETTINGS = [
  'strict',
  'noUnusedLocals',
  'noUnusedParameters',
  'noImplicitAny',
  'noImplicitThis',
  'noImplicitReturns',
  'noFallthroughCasesInSwitch'
]

export const configEnforcementRule: ValidationRule = {
  name: RULE_NAME,
  description:
    'Detects configuration changes that weaken project enforcement standards. Per AGENTS.md: "Avoid backwards-compatibility hacks like renaming unused _vars"',
  severity: SEVERITY,
  appliesTo: ['eslint.config.mjs', 'tsconfig.json', 'dprint.json'],
  excludes: [],

  validate(sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []
    const text = sourceFile.getFullText()

    if (filePath.endsWith('eslint.config.mjs')) {
      violations.push(...validateEslintConfig(text))
    } else if (filePath.endsWith('tsconfig.json')) {
      violations.push(...validateTsConfig(text))
    } else if (filePath.endsWith('dprint.json')) {
      violations.push(...validateDprintConfig(text))
    }

    return violations
  }
}

function validateEslintConfig(text: string): Violation[] {
  const violations: Violation[] = []

  // Check for underscore ignore patterns in no-unused-vars
  // These patterns violate AGENTS.md: "Avoid backwards-compatibility hacks like renaming unused _vars"
  const forbiddenPatterns = [
    {pattern: /argsIgnorePattern.*\^_/m, name: 'argsIgnorePattern'},
    {pattern: /varsIgnorePattern.*\^_/m, name: 'varsIgnorePattern'},
    {pattern: /caughtErrorsIgnorePattern.*\^_/m, name: 'caughtErrorsIgnorePattern'}
  ]

  for (const {pattern, name} of forbiddenPatterns) {
    if (pattern.test(text)) {
      const lineNumber = findLineNumber(text, pattern)
      violations.push(
        createViolation(RULE_NAME, SEVERITY, lineNumber,
          `Underscore ignore pattern "${name}" detected in no-unused-vars rule. This violates AGENTS.md: "Avoid backwards-compatibility hacks like renaming unused _vars"`,
          {
            suggestion:
              'Use object destructuring in function signatures instead of underscore-prefixed unused parameters. For wrappers, use ApiHandlerParams/AuthorizerParams/EventHandlerParams types.'
          })
      )
    }
  }

  // Check for unauthorized ignores
  const ignoresMatch = text.match(/ignores:\s*\[([\s\S]*?)\]/m)
  if (ignoresMatch) {
    const ignoresBlock = ignoresMatch[1]
    const ignoreEntries = ignoresBlock.match(/'[^']+'/g) || []

    for (const entry of ignoreEntries) {
      const ignorePath = entry.replace(/'/g, '')
      if (!ALLOWED_ESLINT_IGNORES.includes(ignorePath)) {
        const lineNumber = findLineNumberForString(text, entry)
        violations.push(
          createViolation(RULE_NAME, 'HIGH', lineNumber, `Unauthorized ESLint ignore pattern: ${ignorePath}`, {
            suggestion: 'Add to ALLOWED_ESLINT_IGNORES in config-enforcement.ts if this is intentional and documented'
          })
        )
      }
    }
  }

  return violations
}

function validateTsConfig(text: string): Violation[] {
  const violations: Violation[] = []

  try {
    const config = JSON.parse(text)
    const compilerOptions = config.compilerOptions || {}

    for (const setting of STRICT_TSCONFIG_SETTINGS) {
      if (setting in compilerOptions && compilerOptions[setting] === false) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, findLineNumberForString(text, `"${setting}"`),
            `Strict TypeScript setting "${setting}" is disabled. This weakens type safety.`, {
            suggestion: `Set "${setting}": true to maintain type safety standards`
          })
        )
      }
    }
  } catch {
    // If we can't parse JSON, skip validation (will be caught by other tools)
  }

  return violations
}

function validateDprintConfig(text: string): Violation[] {
  const violations: Violation[] = []

  try {
    const config = JSON.parse(text)

    // Check for excessively wide line width (relaxation from project standards)
    if (config.lineWidth && config.lineWidth > 200) {
      violations.push(
        createViolation(RULE_NAME, 'MEDIUM', findLineNumberForString(text, '"lineWidth"'),
          `Line width ${config.lineWidth} exceeds recommended maximum of 200 characters`, {
          suggestion: 'Keep line width at or below 200 characters for readability'
        })
      )
    }

    // Check for tabs (project standardized on spaces)
    if (config.useTabs === true) {
      violations.push(
        createViolation(RULE_NAME, 'MEDIUM', findLineNumberForString(text, '"useTabs"'), 'Tab indentation is not allowed (project standardized on spaces)', {
          suggestion: 'Set "useTabs": false'
        })
      )
    }
  } catch {
    // If we can't parse JSON, skip validation
  }

  return violations
}

function findLineNumber(text: string, pattern: RegExp): number {
  const match = text.match(pattern)
  if (!match || match.index === undefined) {
    return 1
  }
  return text.substring(0, match.index).split('\n').length
}

function findLineNumberForString(text: string, searchString: string): number {
  const index = text.indexOf(searchString)
  if (index === -1) {
    return 1
  }
  return text.substring(0, index).split('\n').length
}
