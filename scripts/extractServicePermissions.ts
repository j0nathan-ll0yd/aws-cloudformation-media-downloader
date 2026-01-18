/**
 * Service Permission Extraction Script
 *
 * Uses ts-morph to extract `@RequiresServices` decorator metadata from Lambda handlers
 * and generates a JSON manifest for downstream tooling.
 *
 * Output: build/service-permissions.json
 *
 * Usage: pnpm run extract:service-permissions
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

interface ServicePermission {
  service: 's3' | 'sqs' | 'sns' | 'events'
  resource: string
  operations: string[]
}

interface LambdaServicePermissions {
  services: ServicePermission[]
}

interface ServicePermissionsManifest {
  lambdas: Record<string, LambdaServicePermissions>
  generatedAt: string
}

/**
 * Extract service type from expression like AWSService.S3
 */
function extractServiceType(expr: string): 's3' | 'sqs' | 'sns' | 'events' {
  const match = expr.match(/AWSService\.(\w+)/)
  if (match) {
    const serviceMap: Record<string, 's3' | 'sqs' | 'sns' | 'events'> = {
      'S3': 's3',
      'SQS': 'sqs',
      'SNS': 'sns',
      'EventBridge': 'events'
    }
    return serviceMap[match[1]] || 's3'
  }
  // Handle string literal
  const lower = expr.toLowerCase()
  if (lower.includes('sqs')) return 'sqs'
  if (lower.includes('sns')) return 'sns'
  if (lower.includes('events') || lower.includes('eventbridge')) return 'events'
  return 's3'
}

/**
 * Extract string value from quoted expression
 */
function extractStringValue(expr: string): string {
  const match = expr.match(/['"`]([^'"`]+)['"`]/)
  return match ? match[1] : expr
}

/**
 * Extract operation from expression like S3Operation.GetObject
 */
function extractOperation(expr: string): string {
  // Match enum patterns like S3Operation.GetObject, SQSOperation.SendMessage
  const enumMatch = expr.match(/(\w+Operation)\.(\w+)/)
  if (enumMatch) {
    const [, operationType, opName] = enumMatch
    const opMaps: Record<string, Record<string, string>> = {
      'S3Operation': {
        'GetObject': 's3:GetObject',
        'PutObject': 's3:PutObject',
        'DeleteObject': 's3:DeleteObject',
        'ListBucket': 's3:ListBucket',
        'HeadObject': 's3:HeadObject'
      },
      'SQSOperation': {
        'SendMessage': 'sqs:SendMessage',
        'ReceiveMessage': 'sqs:ReceiveMessage',
        'DeleteMessage': 'sqs:DeleteMessage',
        'GetQueueAttributes': 'sqs:GetQueueAttributes',
        'GetQueueUrl': 'sqs:GetQueueUrl'
      },
      'SNSOperation': {
        'Publish': 'sns:Publish',
        'Subscribe': 'sns:Subscribe'
      },
      'EventBridgeOperation': {
        'PutEvents': 'events:PutEvents'
      }
    }
    return opMaps[operationType]?.[opName] || expr
  }
  // Handle string literal
  return extractStringValue(expr)
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
async function extractPermissions(): Promise<ServicePermissionsManifest> {
  console.log('Loading TypeScript project...')

  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  })

  // Add only Lambda handler files
  const lambdaPattern = join(projectRoot, 'src/lambdas/*/src/index.ts')
  project.addSourceFilesAtPaths(lambdaPattern)

  console.log(`Found ${project.getSourceFiles().length} Lambda handler files`)

  const manifest: ServicePermissionsManifest = {
    lambdas: {},
    generatedAt: new Date().toISOString()
  }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath()
    const lambdaName = extractLambdaName(filePath)

    // Find classes with @RequiresServices decorator
    for (const classDecl of sourceFile.getClasses()) {
      const decorator = classDecl.getDecorator('RequiresServices')
      if (!decorator) continue

      console.log(`Processing ${lambdaName}...`)

      // Get decorator arguments
      const args = decorator.getArguments()
      if (args.length === 0) continue

      // Parse the services array from the decorator argument
      const services: ServicePermission[] = []

      const arrayLiteral = args[0].asKind(SyntaxKind.ArrayLiteralExpression)
      if (arrayLiteral) {
        for (const element of arrayLiteral.getElements()) {
          const serviceObj = element.asKind(SyntaxKind.ObjectLiteralExpression)
          if (serviceObj) {
            let service: 's3' | 'sqs' | 'sns' | 'events' = 's3'
            let resource = ''
            const operations: string[] = []

            for (const prop of serviceObj.getProperties()) {
              if (prop.isKind(SyntaxKind.PropertyAssignment)) {
                const propName = prop.getName()
                const initText = prop.getInitializer()?.getText() || ''

                if (propName === 'service') {
                  service = extractServiceType(initText)
                } else if (propName === 'resource') {
                  resource = extractStringValue(initText)
                } else if (propName === 'operations') {
                  const opsArray = prop.getInitializer()?.asKind(SyntaxKind.ArrayLiteralExpression)
                  if (opsArray) {
                    for (const opElement of opsArray.getElements()) {
                      operations.push(extractOperation(opElement.getText()))
                    }
                  }
                }
              }
            }

            if (resource && operations.length > 0) {
              services.push({service, resource, operations})
            }
          }
        }
      }

      if (services.length > 0) {
        manifest.lambdas[lambdaName] = {services}
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
    const outputPath = join(buildDir, 'service-permissions.json')
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

    console.log(`\nGenerated ${outputPath}`)
    console.log(`Found permissions for ${Object.keys(manifest.lambdas).length} Lambdas:`)

    for (const [name, perms] of Object.entries(manifest.lambdas)) {
      const serviceCount = perms.services.length
      console.log(`  - ${name}: ${serviceCount} service(s)`)
      for (const svc of perms.services) {
        console.log(`      ${svc.service}: ${svc.resource} [${svc.operations.join(', ')}]`)
      }
    }
  } catch (error) {
    console.error('Failed to extract permissions:', error)
    process.exit(1)
  }
}

main()
