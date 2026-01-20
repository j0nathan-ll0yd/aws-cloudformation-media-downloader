/**
 * EventBridge Permission Extraction Script
 *
 * Uses ts-morph to extract `@RequiresEventBridge` decorator metadata from Lambda handlers
 * and generates a JSON manifest for event flow documentation.
 *
 * Output: build/eventbridge-permissions.json
 *
 * Usage: pnpm run extract:eventbridge-permissions
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

interface EventBridgePermission {
  publishes?: string[]
  subscribes?: string[]
  eventBus?: string
}

interface LambdaEventBridgePermissions {
  events: EventBridgePermission
}

interface EventBridgePermissionsManifest {
  lambdas: Record<string, LambdaEventBridgePermissions>
  eventFlow: {
    publishers: Record<string, string[]>  // event type -> lambda names
    subscribers: Record<string, string[]>  // event type -> lambda names
  }
  generatedAt: string
}

/**
 * Extract string value from quoted expression
 */
function extractStringValue(expr: string): string {
  const match = expr.match(/['"`]([^'"`]+)['"`]/)
  return match ? match[1] : expr
}

/**
 * Extract Lambda name from file path
 */
function extractLambdaName(filePath: string): string {
  const match = filePath.match(/lambdas\/([^/]+)\//)
  return match ? match[1] : 'Unknown'
}

/**
 * Main extraction function
 */
async function extractPermissions(): Promise<EventBridgePermissionsManifest> {
  console.log('Loading TypeScript project...')

  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  })

  // Add only Lambda handler files
  const lambdaPattern = join(projectRoot, 'src/lambdas/*/src/index.ts')
  project.addSourceFilesAtPaths(lambdaPattern)

  console.log(`Found ${project.getSourceFiles().length} Lambda handler files`)

  const manifest: EventBridgePermissionsManifest = {
    lambdas: {},
    eventFlow: {
      publishers: {},
      subscribers: {}
    },
    generatedAt: new Date().toISOString()
  }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath()
    const lambdaName = extractLambdaName(filePath)

    // Find classes with @RequiresEventBridge decorator
    for (const classDecl of sourceFile.getClasses()) {
      const decorator = classDecl.getDecorator('RequiresEventBridge')
      if (!decorator) continue

      console.log(`Processing ${lambdaName}...`)

      // Get decorator arguments
      const args = decorator.getArguments()
      if (args.length === 0) continue

      // Parse the permissions object from the decorator argument
      const eventObj = args[0].asKind(SyntaxKind.ObjectLiteralExpression)
      if (!eventObj) continue

      const events: EventBridgePermission = {}

      for (const prop of eventObj.getProperties()) {
        if (prop.isKind(SyntaxKind.PropertyAssignment)) {
          const propName = prop.getName()
          const init = prop.getInitializer()

          if (propName === 'publishes' || propName === 'subscribes') {
            const arrayLiteral = init?.asKind(SyntaxKind.ArrayLiteralExpression)
            if (arrayLiteral) {
              const eventTypes: string[] = []
              for (const element of arrayLiteral.getElements()) {
                eventTypes.push(extractStringValue(element.getText()))
              }
              events[propName] = eventTypes
            }
          } else if (propName === 'eventBus') {
            events.eventBus = extractStringValue(init?.getText() || '')
          }
        }
      }

      if (events.publishes || events.subscribes) {
        manifest.lambdas[lambdaName] = {events}

        // Build event flow maps
        if (events.publishes) {
          for (const eventType of events.publishes) {
            if (!manifest.eventFlow.publishers[eventType]) {
              manifest.eventFlow.publishers[eventType] = []
            }
            manifest.eventFlow.publishers[eventType].push(lambdaName)
          }
        }

        if (events.subscribes) {
          for (const eventType of events.subscribes) {
            if (!manifest.eventFlow.subscribers[eventType]) {
              manifest.eventFlow.subscribers[eventType] = []
            }
            manifest.eventFlow.subscribers[eventType].push(lambdaName)
          }
        }
      }
    }
  }

  return manifest
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const manifest = await extractPermissions()

    // Ensure build directory exists
    const buildDir = join(projectRoot, 'build')
    if (!existsSync(buildDir)) {
      mkdirSync(buildDir, {recursive: true})
    }

    // Write manifest
    const outputPath = join(buildDir, 'eventbridge-permissions.json')
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

    console.log(`\nGenerated ${outputPath}`)
    console.log(`Found permissions for ${Object.keys(manifest.lambdas).length} Lambdas:`)

    for (const [name, perms] of Object.entries(manifest.lambdas)) {
      const pubCount = perms.events.publishes?.length || 0
      const subCount = perms.events.subscribes?.length || 0
      console.log(`  - ${name}: publishes ${pubCount}, subscribes ${subCount}`)
      if (perms.events.publishes?.length) {
        console.log(`      publishes: ${perms.events.publishes.join(', ')}`)
      }
      if (perms.events.subscribes?.length) {
        console.log(`      subscribes: ${perms.events.subscribes.join(', ')}`)
      }
    }

    // Print event flow summary
    console.log('\nEvent Flow Summary:')
    for (const [eventType, lambdas] of Object.entries(manifest.eventFlow.publishers)) {
      const subscribers = manifest.eventFlow.subscribers[eventType] || []
      console.log(`  ${eventType}: ${lambdas.join(', ')} -> ${subscribers.length > 0 ? subscribers.join(', ') : '(no subscribers)'}`)
    }
  } catch (error) {
    console.error('Failed to extract permissions:', error)
    process.exit(1)
  }
}

main()
