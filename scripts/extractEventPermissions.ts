/**
 * Event Permission Extraction Script
 *
 * Extracts EventBridge event publishing information from Lambda handlers
 * by detecting event-specific publisher function calls.
 *
 * The script:
 * 1. Scans Lambda handler files for event-specific function calls
 * 2. Maps function names to event types:
 *    - publishEventDownloadRequested → DownloadRequested
 *    - publishEventDownloadCompleted → DownloadCompleted
 *    - publishEventDownloadFailed → DownloadFailed
 * 3. Generates a JSON manifest for event flow documentation
 *
 * Output: build/event-permissions.json
 *
 * Usage: pnpm run extract:event-permissions
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import {existsSync, mkdirSync, writeFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'
import {Project, SyntaxKind} from 'ts-morph'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

/**
 * Mapping of event-specific function names to event types
 */
const EVENT_FUNCTION_MAP: Record<string, string> = {
  'publishEventDownloadRequested': 'DownloadRequested',
  'publishEventDownloadRequestedWithRetry': 'DownloadRequested',
  'publishEventDownloadCompleted': 'DownloadCompleted',
  'publishEventDownloadFailed': 'DownloadFailed',
}

interface LambdaEventPermissions {
  publishes: string[]
  subscribes: string[]
  sourceFile: string
}

interface EventPermissionsManifest {
  lambdas: Record<string, LambdaEventPermissions>
  eventTypes: string[]
  generatedAt: string
}

/**
 * Extract Lambda name from file path
 * e.g., src/lambdas/StartFileUpload/src/index.ts → StartFileUpload
 */
function extractLambdaName(filePath: string): string | null {
  const match = filePath.match(/src\/lambdas\/([^/]+)\//)
  return match ? match[1] : null
}

/**
 * Find all event-specific function calls in a source file
 */
function findEventPublishCalls(project: Project, filePath: string): string[] {
  const sourceFile = project.getSourceFile(filePath)
  if (!sourceFile) {
    return []
  }

  const events: string[] = []
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  for (const call of callExpressions) {
    const expression = call.getExpression()
    const funcName = expression.getText()

    // Check if this is an event-specific publisher function
    for (const [funcPattern, eventType] of Object.entries(EVENT_FUNCTION_MAP)) {
      if (funcName.includes(funcPattern)) {
        events.push(eventType)
        break
      }
    }
  }

  return [...new Set(events)]
}

/**
 * Determine which events a Lambda subscribes to based on its trigger
 * This is inferred from terraform configuration, not code analysis
 */
function inferSubscriptions(lambdaName: string): string[] {
  // StartFileUpload subscribes to DownloadRequested via SQS (EventBridge → SQS → Lambda)
  const subscriptionMap: Record<string, string[]> = {
    'StartFileUpload': ['DownloadRequested'],
  }
  return subscriptionMap[lambdaName] || []
}

/**
 * Main extraction function
 */
function extractEventPermissions(): EventPermissionsManifest {
  console.log('Extracting EventBridge event permissions...')

  // Initialize ts-morph project
  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  })

  // Find all Lambda handler files
  const lambdaGlob = join(projectRoot, 'src/lambdas/*/src/index.ts')
  const sourceFiles = project.addSourceFilesAtPaths(lambdaGlob)

  console.log(`  Found ${sourceFiles.length} Lambda handlers`)

  const lambdas: Record<string, LambdaEventPermissions> = {}
  const allEventTypes = new Set<string>()

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath()
    const lambdaName = extractLambdaName(filePath)

    if (!lambdaName) {
      continue
    }

    // Find published events
    const publishes = findEventPublishCalls(project, filePath)
    const subscribes = inferSubscriptions(lambdaName)

    // Track all event types
    publishes.forEach(e => allEventTypes.add(e))
    subscribes.forEach(e => allEventTypes.add(e))

    // Only include Lambdas that publish or subscribe to events
    if (publishes.length > 0 || subscribes.length > 0) {
      lambdas[lambdaName] = {
        publishes,
        subscribes,
        sourceFile: filePath.replace(projectRoot + '/', ''),
      }
      console.log(`  ${lambdaName}: publishes=[${publishes.join(', ')}], subscribes=[${subscribes.join(', ')}]`)
    }
  }

  return {
    lambdas,
    eventTypes: [...allEventTypes].sort(),
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Write manifest to build directory
 */
function writeManifest(manifest: EventPermissionsManifest): void {
  const buildDir = join(projectRoot, 'build')
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, {recursive: true})
  }

  const outputPath = join(buildDir, 'event-permissions.json')
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2))
  console.log(`\n✓ Event permissions written to: ${outputPath}`)
  console.log(`  Lambdas with events: ${Object.keys(manifest.lambdas).length}`)
  console.log(`  Event types: ${manifest.eventTypes.join(', ')}`)
}

// Main execution
const manifest = extractEventPermissions()
writeManifest(manifest)
