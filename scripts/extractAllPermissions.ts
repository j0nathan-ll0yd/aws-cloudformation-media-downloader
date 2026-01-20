/**
 * Unified Permission Extraction Script
 *
 * Coordinates all permission extractors and generates a unified manifest.
 * Runs extractors in dependency order:
 * 1. Generate dependency graph
 * 2. Extract Terraform resources
 * 3. Extract service permissions (vendor wrappers)
 * 4. Extract entity permissions (database tables)
 * 5. Extract DynamoDB permissions (Powertools)
 * 6. Generate unified manifest
 *
 * Usage: pnpm run extract:all-permissions
 */

import {execSync} from 'node:child_process'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

interface ServicePermission {
  service: string
  resource: string
  hasWildcard: boolean
  arnRef: string
  operations: string[]
}

interface TablePermission {
  table: string
  operations: string[]
}

interface DynamoDBPermission {
  table: string
  operations: string[]
}

interface SecretPermission {
  type: string
  path: string
  operations: string[]
}

interface EventBridgePermission {
  resource: string
  events: string[]
}

interface LambdaUnifiedPermissions {
  services: ServicePermission[]
  tables: TablePermission[]
  dynamodb: DynamoDBPermission[]
  secrets: SecretPermission[]
  eventbridge: EventBridgePermission[]
}

interface UnifiedPermissionsManifest {
  metadata: {
    generatedAt: string
    extractors: string[]
    extractorStatus: Record<string, 'success' | 'skipped' | 'error'>
  }
  lambdas: Record<string, LambdaUnifiedPermissions>
  summary: {
    totalLambdas: number
    lambdasWithServicePermissions: number
    lambdasWithEntityPermissions: number
    lambdasWithDynamoDBPermissions: number
    lambdasWithSecretPermissions: number
    lambdasWithEventBridgePermissions: number
    uniqueServices: string[]
    uniqueTables: string[]
  }
}

interface ExtractorConfig {
  name: string
  script: string
  output: string
  required: boolean
}

const EXTRACTORS: ExtractorConfig[] = [
  {name: 'graph', script: 'generate:graph', output: 'build/graph.json', required: true},
  {name: 'terraform', script: 'extract:terraform-resources', output: 'build/terraform-resources.json', required: true},
  {name: 'services', script: 'extract:service-permissions', output: 'build/service-permissions.json', required: true},
  {name: 'entities', script: 'extract:entity-permissions', output: 'build/entity-permissions.json', required: true},
  {name: 'dynamodb', script: 'extract:dynamodb-permissions', output: 'build/dynamodb-permissions.json', required: false}
]

/**
 * Run a single extractor
 */
function runExtractor(extractor: ExtractorConfig): 'success' | 'skipped' | 'error' {
  console.log(`\n=== Running ${extractor.name} extractor ===`)

  try {
    execSync(`pnpm run ${extractor.script}`, {
      cwd: projectRoot,
      stdio: 'inherit'
    })

    const outputPath = join(projectRoot, extractor.output)
    if (existsSync(outputPath)) {
      console.log(`  ✓ ${extractor.name} complete: ${extractor.output}`)
      return 'success'
    } else {
      console.warn(`  ⚠ ${extractor.name} ran but output not found: ${extractor.output}`)
      return extractor.required ? 'error' : 'skipped'
    }
  } catch (error) {
    if (extractor.required) {
      console.error(`  ✗ ${extractor.name} failed:`, error)
      return 'error'
    } else {
      console.warn(`  ⚠ ${extractor.name} skipped (optional):`, error)
      return 'skipped'
    }
  }
}

/**
 * Load JSON file if it exists
 */
function loadJson<T>(relativePath: string): T | null {
  const fullPath = join(projectRoot, relativePath)
  if (!existsSync(fullPath)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(fullPath, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Generate unified manifest from individual extractor outputs
 */
function generateUnifiedManifest(extractorStatus: Record<string, 'success' | 'skipped' | 'error'>): UnifiedPermissionsManifest {
  console.log('\n=== Generating unified manifest ===')

  // Load individual manifests
  const serviceManifest = loadJson<{
    lambdas: Record<string, {services: ServicePermission[]}>
    vendorMethods: Record<string, unknown>
  }>('build/service-permissions.json')

  const entityManifest = loadJson<{
    lambdas: Record<string, {tables: TablePermission[]}>
  }>('build/entity-permissions.json')

  const dynamodbManifest = loadJson<{
    lambdas: Record<string, {tables: DynamoDBPermission[]}>
  }>('build/dynamodb-permissions.json')

  // Collect all unique Lambda names
  const allLambdaNames = new Set<string>()
  if (serviceManifest?.lambdas) {
    Object.keys(serviceManifest.lambdas).forEach((name) => allLambdaNames.add(name))
  }
  if (entityManifest?.lambdas) {
    Object.keys(entityManifest.lambdas).forEach((name) => allLambdaNames.add(name))
  }
  if (dynamodbManifest?.lambdas) {
    Object.keys(dynamodbManifest.lambdas).forEach((name) => allLambdaNames.add(name))
  }

  // Build unified permissions per Lambda
  const lambdas: Record<string, LambdaUnifiedPermissions> = {}
  const uniqueServices = new Set<string>()
  const uniqueTables = new Set<string>()

  for (const name of allLambdaNames) {
    const services = serviceManifest?.lambdas?.[name]?.services || []
    const tables = entityManifest?.lambdas?.[name]?.tables || []
    const dynamodb = dynamodbManifest?.lambdas?.[name]?.tables || []

    // Track unique services and tables
    services.forEach((s) => uniqueServices.add(s.service))
    tables.forEach((t) => uniqueTables.add(t.table))
    dynamodb.forEach((d) => uniqueTables.add(d.table))

    lambdas[name] = {
      services,
      tables,
      dynamodb,
      secrets: [], // Not currently extracted
      eventbridge: [] // Extracted as part of services
    }
  }

  // Count stats
  let lambdasWithServicePermissions = 0
  let lambdasWithEntityPermissions = 0
  let lambdasWithDynamoDBPermissions = 0
  let lambdasWithSecretPermissions = 0
  let lambdasWithEventBridgePermissions = 0

  for (const lambda of Object.values(lambdas)) {
    if (lambda.services.length > 0) lambdasWithServicePermissions++
    if (lambda.tables.length > 0) lambdasWithEntityPermissions++
    if (lambda.dynamodb.length > 0) lambdasWithDynamoDBPermissions++
    if (lambda.secrets.length > 0) lambdasWithSecretPermissions++
    if (lambda.eventbridge.length > 0) lambdasWithEventBridgePermissions++
  }

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      extractors: EXTRACTORS.map((e) => e.name),
      extractorStatus
    },
    lambdas,
    summary: {
      totalLambdas: allLambdaNames.size,
      lambdasWithServicePermissions,
      lambdasWithEntityPermissions,
      lambdasWithDynamoDBPermissions,
      lambdasWithSecretPermissions,
      lambdasWithEventBridgePermissions,
      uniqueServices: Array.from(uniqueServices).sort(),
      uniqueTables: Array.from(uniqueTables).sort()
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('Starting unified permission extraction...')
  const startTime = Date.now()

  // Ensure build directory exists
  const buildDir = join(projectRoot, 'build')
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, {recursive: true})
  }

  // Run all extractors
  const extractorStatus: Record<string, 'success' | 'skipped' | 'error'> = {}
  let hasRequiredError = false

  for (const extractor of EXTRACTORS) {
    const status = runExtractor(extractor)
    extractorStatus[extractor.name] = status

    if (status === 'error' && extractor.required) {
      hasRequiredError = true
      console.error(`\n✗ Required extractor ${extractor.name} failed. Aborting.`)
      process.exit(1)
    }
  }

  // Generate unified manifest
  const unified = generateUnifiedManifest(extractorStatus)

  // Write unified manifest
  const outputPath = join(buildDir, 'unified-permissions.json')
  writeFileSync(outputPath, JSON.stringify(unified, null, 2))

  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log('\n=== Extraction Complete ===')
  console.log(`Duration: ${duration}s`)
  console.log(`Output: ${outputPath}`)
  console.log('\nSummary:')
  console.log(`  Total Lambdas: ${unified.summary.totalLambdas}`)
  console.log(`  With Service Permissions: ${unified.summary.lambdasWithServicePermissions}`)
  console.log(`  With Entity Permissions: ${unified.summary.lambdasWithEntityPermissions}`)
  console.log(`  With DynamoDB Permissions: ${unified.summary.lambdasWithDynamoDBPermissions}`)
  console.log(`  Unique Services: ${unified.summary.uniqueServices.join(', ')}`)
  console.log(`  Unique Tables: ${unified.summary.uniqueTables.join(', ')}`)

  console.log('\nExtractor Status:')
  for (const [name, status] of Object.entries(extractorStatus)) {
    const icon = status === 'success' ? '✓' : status === 'skipped' ? '⚠' : '✗'
    console.log(`  ${icon} ${name}: ${status}`)
  }

  if (hasRequiredError) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Unified extraction failed:', error)
  process.exit(1)
})
