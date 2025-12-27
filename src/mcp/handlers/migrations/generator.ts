/**
 * Migration generator handler for MCP server
 * Generates multi-file migration scripts from convention violations
 *
 * Features:
 * - Analyzes violations from validate_pattern
 * - Creates migration plans with dependency ordering
 * - Generates executable ts-morph scripts
 * - Verifies migration completeness
 */

import {Project} from 'ts-morph'
import path from 'path'
import {fileURLToPath} from 'url'
import {handleValidationQuery} from '../validation.js'
import {loadDependencyGraph} from '../data-loader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../../../..')

export type MigrationQueryType = 'plan' | 'script' | 'verify'

export interface MigrationArgs {
  query: MigrationQueryType
  convention?: string
  scope?: string[]
  outputFormat?: 'ts-morph' | 'codemod' | 'shell'
  execute?: boolean
}

interface Violation {
  file: string
  rule: string
  severity: string
  line: number
  message: string
  suggestion?: string
}

interface CodeChange {
  type: 'replace_import' | 'replace_call' | 'add_import' | 'reorder_imports' | 'wrap_expression'
  from?: string
  to?: string
  line?: number
  context?: string
}

interface FileMigration {
  file: string
  changes: CodeChange[]
  dependencies: string[]
  priority: number
}

interface MigrationPlan {
  convention: string
  totalFiles: number
  totalChanges: number
  migrations: FileMigration[]
  estimatedDuration: string
  rollbackPlan: string
}

// Import mappings for aws-sdk-wrapper convention
const AWS_SDK_MAPPING: Record<string, {wrapper: string; functions: string[]}> = {
  '@aws-sdk/client-dynamodb': {wrapper: '#lib/vendor/AWS/DynamoDB', functions: ['queryItems', 'getItem', 'putItem', 'deleteItem']},
  '@aws-sdk/lib-dynamodb': {wrapper: '#lib/vendor/AWS/DynamoDB', functions: ['queryItems', 'getItem', 'putItem', 'deleteItem']},
  '@aws-sdk/client-s3': {wrapper: '#lib/vendor/AWS/S3', functions: ['uploadToS3', 'getObject', 'deleteObject']},
  '@aws-sdk/client-lambda': {wrapper: '#lib/vendor/AWS/Lambda', functions: ['invokeFunction', 'invokeFunctionAsync']},
  '@aws-sdk/client-sns': {wrapper: '#lib/vendor/AWS/SNS', functions: ['publishToSNS', 'createPlatformEndpoint']},
  '@aws-sdk/client-sqs': {wrapper: '#lib/vendor/AWS/SQS', functions: ['sendMessage', 'receiveMessage']}
}

/**
 * Get violations for a specific convention
 */
async function getViolations(convention: string, scope?: string[]): Promise<Violation[]> {
  const result = await handleValidationQuery({query: convention === 'all' ? 'all' : convention as 'aws-sdk' | 'electrodb' | 'imports' | 'response'})

  if ('violations' in result) {
    let violations = result.violations as Violation[]

    // Filter by scope if provided
    if (scope && scope.length > 0) {
      violations = violations.filter((v) => scope.some((s) => v.file.includes(s)))
    }

    return violations
  }

  return []
}

/**
 * Analyze violations and create migration plan
 */
async function createMigrationPlan(convention: string, scope?: string[]): Promise<MigrationPlan> {
  const violations = await getViolations(convention, scope)

  if (violations.length === 0) {
    return {convention, totalFiles: 0, totalChanges: 0, migrations: [], estimatedDuration: '0 seconds', rollbackPlan: 'No changes to rollback'}
  }

  // Group violations by file
  const byFile = new Map<string, Violation[]>()
  for (const v of violations) {
    const existing = byFile.get(v.file) || []
    existing.push(v)
    byFile.set(v.file, existing)
  }

  // Create file migrations
  const migrations: FileMigration[] = []
  const depGraph = await loadDependencyGraph()

  for (const [file, fileViolations] of byFile) {
    const changes: CodeChange[] = []

    for (const v of fileViolations) {
      // Generate changes based on rule
      if (v.rule === 'aws-sdk-encapsulation') {
        // Extract the forbidden import from the message
        const importMatch = v.message.match(/from '([^']+)'/)
        if (importMatch) {
          const fromModule = importMatch[1]
          const mapping = AWS_SDK_MAPPING[fromModule]
          if (mapping) {
            changes.push({type: 'replace_import', from: fromModule, to: mapping.wrapper, line: v.line, context: v.message})
          }
        }
      } else if (v.rule === 'import-order') {
        changes.push({type: 'reorder_imports', context: v.message})
      } else if (v.rule === 'env-validation') {
        const envMatch = v.message.match(/process\.env\.(\w+)/)
        if (envMatch) {
          changes.push({type: 'replace_call', from: `process.env.${envMatch[1]}`, to: `getRequiredEnv('${envMatch[1]}')`, line: v.line})
        }
      } else if (v.rule === 'response-helpers') {
        changes.push({type: 'wrap_expression', from: 'raw response', to: 'buildApiResponse()', line: v.line})
      }
    }

    // Calculate dependencies (files that must be migrated first)
    const normalizedFile = file.startsWith('src/') ? file : `src/${file}`
    const deps = depGraph.transitiveDependencies[normalizedFile] || []
    const affectedDeps = deps.filter((d) => byFile.has(d))

    migrations.push({file, changes, dependencies: affectedDeps, priority: affectedDeps.length})
  }

  // Sort by priority (files with fewer dependencies first)
  migrations.sort((a, b) => a.priority - b.priority)

  // Estimate duration based on changes
  const totalChanges = migrations.reduce((sum, m) => sum + m.changes.length, 0)
  const estimatedSeconds = totalChanges * 0.5 + migrations.length * 2

  return {
    convention,
    totalFiles: migrations.length,
    totalChanges,
    migrations,
    estimatedDuration: `${Math.ceil(estimatedSeconds)} seconds`,
    rollbackPlan: `git checkout -- ${migrations.map((m) => m.file).join(' ')}`
  }
}

/**
 * Generate ts-morph migration script
 */
function generateTsMorphScript(plan: MigrationPlan): string {
  const imports = [`import {Project, SyntaxKind} from 'ts-morph'`, `import path from 'path'`]

  const migrationCode = plan.migrations.map((m) => {
    const changeCode = m.changes.map((c) => {
      if (c.type === 'replace_import') {
        return `    // Replace import: ${c.from} -> ${c.to}
    for (const imp of sourceFile.getImportDeclarations()) {
      if (imp.getModuleSpecifierValue() === '${c.from}') {
        imp.setModuleSpecifier('${c.to}')
        console.log('  Replaced import: ${c.from} -> ${c.to}')
      }
    }`
      } else if (c.type === 'replace_call') {
        return `    // Replace call: ${c.from} -> ${c.to}
    const regex = /${c.from?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/g
    const text = sourceFile.getFullText()
    if (regex.test(text)) {
      sourceFile.replaceWithText(text.replace(regex, '${c.to}'))
      console.log('  Replaced: ${c.from} -> ${c.to}')
    }`
      } else if (c.type === 'reorder_imports') {
        return `    // TODO: Reorder imports - requires complex logic
    console.log('  Import reordering needed at line ${c.line || 'unknown'}')`
      }
      return `    // TODO: ${c.type} - manual intervention required`
    }).join('\n\n')

    return `  // File: ${m.file}
  {
    const sourceFile = project.getSourceFileOrThrow('${m.file}')
    console.log('Processing: ${m.file}')
${changeCode}
  }`
  }).join('\n\n')

  return `#!/usr/bin/env tsx
/**
 * Auto-generated migration script for: ${plan.convention}
 * Total files: ${plan.totalFiles}
 * Total changes: ${plan.totalChanges}
 *
 * Usage:
 *   npx tsx migration-${plan.convention}.ts        # Dry run
 *   npx tsx migration-${plan.convention}.ts --apply  # Apply changes
 *
 * Rollback:
 *   ${plan.rollbackPlan}
 */

${imports.join('\n')}

const projectRoot = process.cwd()
const dryRun = !process.argv.includes('--apply')

async function migrate() {
  console.log(\`Migration: ${plan.convention}\`)
  console.log(\`Mode: \${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}\`)
  console.log('')

  const project = new Project({
    tsConfigFilePath: path.join(projectRoot, 'tsconfig.json')
  })

${migrationCode}

  if (!dryRun) {
    console.log('')
    console.log('Saving changes...')
    await project.save()
    console.log('Done!')
  } else {
    console.log('')
    console.log('Dry run complete. Use --apply to save changes.')
  }
}

migrate().catch(console.error)
`
}

/**
 * Generate shell script for simple migrations
 */
function generateShellScript(plan: MigrationPlan): string {
  const commands = plan.migrations.flatMap((m) =>
    m.changes.filter((c) => c.type === 'replace_import' || c.type === 'replace_call').map((c) => {
      if (c.from && c.to) {
        return `sed -i '' "s|${c.from}|${c.to}|g" "${m.file}"`
      }
      return `# TODO: ${c.type} in ${m.file}`
    })
  )

  return `#!/bin/bash
# Auto-generated migration script for: ${plan.convention}
# Total files: ${plan.totalFiles}
# Total changes: ${plan.totalChanges}
#
# Rollback: ${plan.rollbackPlan}

set -e

echo "Migration: ${plan.convention}"

${commands.join('\n')}

echo "Done!"
`
}

/**
 * Verify migration completeness
 */
async function verifyMigration(convention: string, scope?: string[]): Promise<{complete: boolean; remaining: number; files: string[]}> {
  const violations = await getViolations(convention, scope)

  const remainingFiles = [...new Set(violations.map((v) => v.file))]

  return {complete: violations.length === 0, remaining: violations.length, files: remainingFiles}
}

/**
 * Execute migration (apply changes)
 */
async function executeMigration(plan: MigrationPlan): Promise<{success: boolean; filesModified: number; errors: string[]}> {
  const errors: string[] = []
  let filesModified = 0

  const project = new Project({tsConfigFilePath: path.join(projectRoot, 'tsconfig.json')})

  for (const migration of plan.migrations) {
    try {
      const sourceFile = project.addSourceFileAtPath(path.join(projectRoot, migration.file))

      for (const change of migration.changes) {
        if (change.type === 'replace_import' && change.from && change.to) {
          for (const imp of sourceFile.getImportDeclarations()) {
            if (imp.getModuleSpecifierValue() === change.from) {
              imp.setModuleSpecifier(change.to)
            }
          }
        }
        // Add more change types as needed
      }

      filesModified++
    } catch (error) {
      errors.push(`${migration.file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (errors.length === 0) {
    await project.save()
  }

  return {success: errors.length === 0, filesModified, errors}
}

/**
 * Main handler for migration queries
 */
export async function handleMigrationQuery(args: MigrationArgs) {
  const {query, convention = 'all', scope, outputFormat = 'ts-morph', execute = false} = args

  switch (query) {
    case 'plan': {
      const plan = await createMigrationPlan(convention, scope)

      if (plan.totalFiles === 0) {
        return {convention, message: 'No violations found - codebase follows convention', scope}
      }

      return {
        plan,
        summary: {convention, totalFiles: plan.totalFiles, totalChanges: plan.totalChanges, estimatedDuration: plan.estimatedDuration},
        migrations: plan.migrations.map((m) => ({
          file: m.file,
          changeCount: m.changes.length,
          changes: m.changes.map((c) => `${c.type}: ${c.from || ''} -> ${c.to || ''}`),
          priority: m.priority
        })),
        nextStep: `Use query: 'script' to generate executable migration script`
      }
    }

    case 'script': {
      const plan = await createMigrationPlan(convention, scope)

      if (plan.totalFiles === 0) {
        return {convention, message: 'No violations to migrate', scope}
      }

      let script: string
      let filename: string

      switch (outputFormat) {
        case 'shell':
          script = generateShellScript(plan)
          filename = `migration-${convention}.sh`
          break
        case 'ts-morph':
        default:
          script = generateTsMorphScript(plan)
          filename = `migration-${convention}.ts`
      }

      if (execute) {
        const result = await executeMigration(plan)
        return {executed: true, ...result, plan: {files: plan.totalFiles, changes: plan.totalChanges}}
      }

      return {
        convention,
        outputFormat,
        filename,
        script,
        usage: outputFormat === 'ts-morph' ? `npx tsx ${filename} --apply` : `bash ${filename}`,
        plan: {files: plan.totalFiles, changes: plan.totalChanges}
      }
    }

    case 'verify': {
      const result = await verifyMigration(convention, scope)

      return {
        convention,
        scope,
        complete: result.complete,
        remainingViolations: result.remaining,
        remainingFiles: result.files,
        message: result.complete
          ? 'Migration complete - all violations resolved'
          : `${result.remaining} violation(s) remaining in ${result.files.length} file(s)`
      }
    }

    default:
      return {
        error: `Unknown query type: ${query}`,
        availableQueries: ['plan', 'script', 'verify'],
        examples: [
          {query: 'plan', convention: 'aws-sdk'},
          {query: 'script', convention: 'aws-sdk', outputFormat: 'ts-morph'},
          {query: 'verify', convention: 'aws-sdk'}
        ]
      }
  }
}
