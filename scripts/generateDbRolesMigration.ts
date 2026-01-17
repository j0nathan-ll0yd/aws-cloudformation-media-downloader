/**
 * Database Role Migration Generator
 *
 * Reads build/db-permissions.json and generates PostgreSQL migration SQL
 * for IAM role assignments based on @RequiresDatabase decorator metadata.
 *
 * Output: migrations/NNNN_lambda_iam_grants.sql
 *
 * Usage: pnpm run generate:db-roles-migration
 *
 * @see docs/wiki/Infrastructure/Database-Permissions.md
 */
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

interface TablePermission {
  table: string
  operations: string[]
}

interface LambdaPermissions {
  tables: TablePermission[]
  description?: string
  computedAccessLevel: 'readonly' | 'readwrite' | 'admin'
}

interface PermissionsManifest {
  lambdas: Record<string, LambdaPermissions>
  generatedAt: string
}

/**
 * Get the next migration version number
 */
function getNextMigrationVersion(): string {
  const migrationsDir = join(projectRoot, 'migrations')
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
  if (files.length === 0) {
    return '0001'
  }
  const lastFile = files[files.length - 1]
  const match = lastFile.match(/^(\d+)_/)
  if (!match) {
    return '0001'
  }
  const nextVersion = parseInt(match[1], 10) + 1
  return nextVersion.toString().padStart(4, '0')
}

/**
 * Generate SQL for IAM role grants
 */
function generateIamGrantsSql(manifest: PermissionsManifest): string {
  const lines: string[] = [
    '-- Auto-generated Lambda IAM role grants from @RequiresDatabase decorators',
    `-- Generated at: ${new Date().toISOString()}`,
    '-- Source: build/db-permissions.json',
    '--',
    '-- This migration updates IAM role associations based on declared permissions.',
    '-- Uses Aurora DSQL AWS IAM GRANT syntax.',
    '-- Note: ${AWS_ACCOUNT_ID} is replaced at runtime by MigrateDSQL handler',
    ''
  ]

  // Group Lambdas by access level
  const byAccessLevel: Record<string, string[]> = {
    readonly: [],
    readwrite: [],
    admin: []
  }

  for (const [lambdaName, perms] of Object.entries(manifest.lambdas)) {
    byAccessLevel[perms.computedAccessLevel].push(lambdaName)
  }

  // ReadOnly Lambdas
  if (byAccessLevel.readonly.length > 0) {
    lines.push('-- ReadOnly Lambdas: app_readonly role (SELECT only)')
    for (const lambda of byAccessLevel.readonly.sort()) {
      lines.push(`AWS IAM GRANT app_readonly TO 'arn:aws:iam::\${AWS_ACCOUNT_ID}:role/${lambda}';`)
    }
    lines.push('')
  }

  // ReadWrite Lambdas
  if (byAccessLevel.readwrite.length > 0) {
    lines.push('-- ReadWrite Lambdas: app_readwrite role (full DML)')
    for (const lambda of byAccessLevel.readwrite.sort()) {
      lines.push(`AWS IAM GRANT app_readwrite TO 'arn:aws:iam::\${AWS_ACCOUNT_ID}:role/${lambda}';`)
    }
    lines.push('')
  }

  // Admin Lambdas
  if (byAccessLevel.admin.length > 0) {
    lines.push('-- Admin Lambdas: admin role (DDL + full DML)')
    lines.push('-- NOTE: admin role is a built-in Aurora DSQL role, no GRANT needed for IAM auth')
    for (const lambda of byAccessLevel.admin.sort()) {
      lines.push(`-- ${lambda} uses admin role via DSQL_ACCESS_LEVEL=admin`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generate detailed permission report
 */
function generatePermissionReport(manifest: PermissionsManifest): string {
  const lines: string[] = [
    '# Database Permissions Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Lambda Permissions Summary',
    '',
    '| Lambda | Access Level | Tables | Operations |',
    '|--------|-------------|--------|------------|'
  ]

  for (const [lambdaName, perms] of Object.entries(manifest.lambdas).sort()) {
    const tableCount = perms.tables.length
    const allOps = new Set<string>()
    for (const t of perms.tables) {
      for (const op of t.operations) {
        allOps.add(op)
      }
    }
    lines.push(`| ${lambdaName} | ${perms.computedAccessLevel} | ${tableCount} | ${[...allOps].sort().join(', ')} |`)
  }

  lines.push('')
  lines.push('## Detailed Permissions')
  lines.push('')

  for (const [lambdaName, perms] of Object.entries(manifest.lambdas).sort()) {
    lines.push(`### ${lambdaName}`)
    lines.push('')
    lines.push(`**Access Level**: ${perms.computedAccessLevel}`)
    if (perms.description) {
      lines.push(`**Description**: ${perms.description}`)
    }
    lines.push('')
    lines.push('| Table | Operations |')
    lines.push('|-------|------------|')
    for (const t of perms.tables) {
      lines.push(`| ${t.table} | ${t.operations.join(', ')} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Compare with existing migration
 */
function compareWithExisting(manifest: PermissionsManifest): void {
  const existingPath = join(projectRoot, 'migrations/0004_grant_iam_roles.sql')
  if (!existsSync(existingPath)) {
    console.log('\nNo existing IAM grants migration found.')
    return
  }

  const existing = readFileSync(existingPath, 'utf-8')

  console.log('\n=== Comparison with existing 0004_grant_iam_roles.sql ===\n')

  const mismatches: string[] = []

  for (const [lambdaName, perms] of Object.entries(manifest.lambdas)) {
    const readonlyPattern = new RegExp(`app_readonly.*${lambdaName}`)
    const readwritePattern = new RegExp(`app_readwrite.*${lambdaName}`)

    const isReadonly = readonlyPattern.test(existing)
    const isReadwrite = readwritePattern.test(existing)

    if (perms.computedAccessLevel === 'readonly' && isReadwrite && !isReadonly) {
      mismatches.push(`  - ${lambdaName}: currently readwrite, should be readonly`)
    } else if (perms.computedAccessLevel === 'readwrite' && isReadonly && !isReadwrite) {
      mismatches.push(`  - ${lambdaName}: currently readonly, should be readwrite`)
    }
  }

  if (mismatches.length > 0) {
    console.log('MISMATCHES FOUND:')
    for (const m of mismatches) {
      console.log(m)
    }
    console.log('')
    console.log('Consider running the generated migration to fix these.')
  } else {
    console.log('All access levels match the existing migration.')
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const manifestPath = join(projectRoot, 'build/db-permissions.json')

  if (!existsSync(manifestPath)) {
    console.error('Error: build/db-permissions.json not found.')
    console.error('Run: pnpm run extract:db-permissions first.')
    process.exit(1)
  }

  const manifest: PermissionsManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  console.log(`Loaded permissions for ${Object.keys(manifest.lambdas).length} Lambdas`)
  console.log(`Generated at: ${manifest.generatedAt}`)

  // Generate SQL migration
  const sql = generateIamGrantsSql(manifest)
  const version = getNextMigrationVersion()
  const migrationPath = join(projectRoot, `migrations/${version}_lambda_iam_grants_generated.sql`)

  writeFileSync(migrationPath, sql)
  console.log(`\nGenerated migration: ${migrationPath}`)

  // Generate markdown report
  const report = generatePermissionReport(manifest)
  const reportPath = join(projectRoot, 'build/db-permissions-report.md')
  writeFileSync(reportPath, report)
  console.log(`Generated report: ${reportPath}`)

  // Compare with existing migration
  compareWithExisting(manifest)

  // Print summary
  console.log('\n=== Access Level Summary ===')
  const counts = {readonly: 0, readwrite: 0, admin: 0}
  for (const perms of Object.values(manifest.lambdas)) {
    counts[perms.computedAccessLevel]++
  }
  console.log(`  readonly:  ${counts.readonly} Lambdas`)
  console.log(`  readwrite: ${counts.readwrite} Lambdas`)
  console.log(`  admin:     ${counts.admin} Lambdas`)
}

main().catch(error => {
  console.error('Failed to generate migration:', error)
  process.exit(1)
})
