/**
 * Database Permissions Rule
 *
 * DEPRECATED: This rule is no longer active.
 *
 * As of PR #353, database permissions are now derived automatically from \@RequiresTable
 * decorators on entity query methods via build-time call-graph analysis. The @RequiresDatabase
 * decorator on Lambda handlers is no longer used.
 *
 * See: scripts/extractEntityPermissions.ts for the new permission extraction system.
 *
 * This rule is kept for reference but always returns no violations.
 */

import type {SourceFile} from 'ts-morph'
import type {ValidationRule, Violation} from '../types'

const RULE_NAME = 'database-permissions'
const SEVERITY = 'HIGH' as const

export const databasePermissionsRule: ValidationRule = {
  name: RULE_NAME,
  description: 'DEPRECATED: Database permissions are now derived automatically from @RequiresTable decorators via build-time call-graph analysis.',
  severity: SEVERITY,
  appliesTo: ['src/lambdas/*/src/index.ts'],
  excludes: [],

  validate(_sourceFile: SourceFile, _filePath: string): Violation[] {
    // DEPRECATED: This rule is no longer active.
    // Database permissions are now derived automatically from @RequiresTable decorators
    // on entity query methods via build-time call-graph analysis.
    // See: scripts/extractEntityPermissions.ts
    void _sourceFile
    void _filePath
    return []
  }
}
