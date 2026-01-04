/**
 * Aurora DSQL ASYNC Index Rule
 * HIGH: CREATE INDEX statements in Aurora DSQL must use ASYNC keyword
 *
 * Aurora DSQL requires non-blocking index creation. Without ASYNC, CREATE INDEX
 * will block all writes to the table until complete, which can cause significant
 * downtime in production.
 *
 * @see docs/wiki/Conventions/Database-Migrations.md
 */

import {readFileSync} from 'fs'
import type {SourceFile} from 'ts-morph'
import {createViolation} from '../types'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'aurora-dsql-async-index'
const SEVERITY = 'HIGH' as const

/**
 * Pattern to match CREATE INDEX without ASYNC
 * Matches: CREATE INDEX, CREATE UNIQUE INDEX
 * But NOT: CREATE INDEX ASYNC, CREATE UNIQUE INDEX ASYNC
 */
const CREATE_INDEX_PATTERN = /CREATE\s+(UNIQUE\s+)?INDEX(?!\s+ASYNC)/gi

export const auroraDsqlAsyncIndexRule: ValidationRule = {
  name: RULE_NAME,
  description: 'Aurora DSQL CREATE INDEX must use ASYNC keyword to avoid blocking writes during index creation',
  severity: SEVERITY,
  appliesTo: ['migrations/*.sql'],
  excludes: [],

  validate(_sourceFile: SourceFile, filePath: string): Violation[] {
    const violations: Violation[] = []

    // Only validate SQL migration files
    if (!filePath.endsWith('.sql')) {
      return violations
    }

    let sqlContent: string
    try {
      sqlContent = readFileSync(filePath, 'utf-8')
    } catch {
      // File read error - skip validation
      return violations
    }

    const lines = sqlContent.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1

      // Skip comment lines
      if (line.trim().startsWith('--')) {
        continue
      }

      // Reset regex lastIndex for each line
      CREATE_INDEX_PATTERN.lastIndex = 0

      // Check for CREATE INDEX without ASYNC
      if (CREATE_INDEX_PATTERN.test(line)) {
        violations.push(
          createViolation(RULE_NAME, SEVERITY, lineNumber, 'CREATE INDEX without ASYNC keyword will block writes in Aurora DSQL', {
            suggestion: 'Use CREATE INDEX ASYNC (or CREATE UNIQUE INDEX ASYNC) for non-blocking index creation',
            codeSnippet: line.trim().substring(0, 100)
          })
        )
      }
    }

    return violations
  }
}
