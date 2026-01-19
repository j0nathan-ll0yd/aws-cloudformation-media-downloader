/**
 * Service Permission Extraction Script
 *
 * Phase 7: Function-Level Permission Extraction
 *
 * Uses ts-morph to extract permission metadata from:
 * 1. Vendor wrapper classes with RequiresXxx method decorators
 * 2. Lambda handlers with RequiresServices class decorators (legacy, to be removed)
 *
 * The script:
 * 1. Parses vendor wrapper classes for RequiresSNS, RequiresS3, RequiresSQS, RequiresEventBridge
 * 2. Uses build/graph.json to trace Lambda dependencies
 * 3. Aggregates permissions from all vendor files each Lambda imports
 * 4. Generates a JSON manifest for Terraform IAM policy generation
 *
 * Output: build/service-permissions.json
 *
 * Usage: pnpm run extract:service-permissions
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs'
import {dirname, join, relative} from 'path'
import {fileURLToPath} from 'url'
import {Project, SyntaxKind} from 'ts-morph'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

type ServiceType = 's3' | 'sqs' | 'sns' | 'events'

interface ServicePermission {
  service: ServiceType
  resource: string
  hasWildcard: boolean
  arnRef: string
  operations: string[]
}

interface LambdaServicePermissions {
  services: ServicePermission[]
}

interface ServicePermissionsManifest {
  lambdas: Record<string, LambdaServicePermissions>
  vendorMethods: Record<string, VendorMethodPermission>
  generatedAt: string
}

interface TerraformResourceEntry {
  name: string
  terraformId: string
  arnRef: string
}

interface TerraformResourceManifest {
  s3Buckets: TerraformResourceEntry[]
  sqsQueues: TerraformResourceEntry[]
  snsTopics: TerraformResourceEntry[]
  snsPlatformApplications: TerraformResourceEntry[]
  eventBridgeBuses: TerraformResourceEntry[]
}

interface VendorMethodPermission {
  className: string
  methodName: string
  filePath: string
  permissions: ServicePermission[]
}

interface DependencyGraph {
  files: Record<string, {imports: string[]}>
  transitiveDependencies: Record<string, string[]>
}

/**
 * Load dependency graph from build/graph.json
 */
function loadDependencyGraph(): DependencyGraph | null {
  const graphPath = join(projectRoot, 'build/graph.json')
  if (!existsSync(graphPath)) {
    console.warn('Warning: build/graph.json not found. Dependency tracing disabled.')
    console.warn('Run: pnpm run build first to generate the dependency graph.')
    return null
  }
  return JSON.parse(readFileSync(graphPath, 'utf-8'))
}

/**
 * Load Terraform resource manifest for ARN reference lookup
 */
function loadTerraformResources(): TerraformResourceManifest | null {
  const manifestPath = join(projectRoot, 'build/terraform-resources.json')
  if (!existsSync(manifestPath)) {
    console.warn('Warning: build/terraform-resources.json not found. ARN references will be incomplete.')
    console.warn('Run: pnpm run extract:terraform-resources first.')
    return null
  }
  return JSON.parse(readFileSync(manifestPath, 'utf-8'))
}

/**
 * Get Terraform ARN reference for a resource
 */
function getArnRef(service: ServiceType, resourceName: string, terraformResources: TerraformResourceManifest | null): string {
  if (!terraformResources) {
    return `${resourceName}.arn`
  }

  let resources: TerraformResourceEntry[] = []
  switch (service) {
    case 's3':
      resources = terraformResources.s3Buckets
      break
    case 'sqs':
      resources = terraformResources.sqsQueues
      break
    case 'sns':
      // Check both topics and platform applications
      resources = [...terraformResources.snsTopics, ...terraformResources.snsPlatformApplications]
      break
    case 'events':
      resources = terraformResources.eventBridgeBuses
      break
  }

  const entry = resources.find((r) => r.name === resourceName)
  return entry?.arnRef || `${resourceName}.arn`
}

/**
 * Extract service type from decorator name
 */
function getServiceFromDecorator(decoratorName: string): ServiceType {
  const decoratorMap: Record<string, ServiceType> = {
    'RequiresSNS': 'sns',
    'RequiresS3': 's3',
    'RequiresSQS': 'sqs',
    'RequiresEventBridge': 'events'
  }
  return decoratorMap[decoratorName] || 's3'
}

/**
 * Extract service type from expression like AWSService.S3
 */
function extractServiceType(expr: string): ServiceType {
  const match = expr.match(/AWSService\.(\w+)/)
  if (match) {
    const serviceMap: Record<string, ServiceType> = {
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
 * Extract resource name and wildcard flag from resource expression.
 * Handles:
 * - Enum values: S3Resource.Files - returns name: 'Files', hasWildcard: false
 * - Template literals with wildcard: `${S3Resource.Files}/*` - returns name: 'Files', hasWildcard: true
 * - String literals: 'media-bucket/*' - returns name: 'media-bucket', hasWildcard: true
 */
function extractResourceValue(expr: string): {name: string; hasWildcard: boolean} {
  // Handle template literal with enum: `${S3Resource.Files}/*`
  const templateMatch = expr.match(/`\$\{(\w+Resource)\.(\w+)\}(\/\*)?`/)
  if (templateMatch) {
    const hasWildcard = templateMatch[3] === '/*'
    return {name: templateMatch[2], hasWildcard}
  }

  // Handle enum value: S3Resource.Files, SQSResource.SendPushNotification, etc.
  const enumMatch = expr.match(/(\w+Resource)\.(\w+)/)
  if (enumMatch) {
    return {name: enumMatch[2], hasWildcard: false}
  }

  // Handle string literal (legacy): 'media-bucket/*'
  const stringMatch = expr.match(/['"`]([^'"`]+)['"`]/)
  if (stringMatch) {
    const value = stringMatch[1]
    const hasWildcard = value.endsWith('/*')
    const name = hasWildcard ? value.slice(0, -2) : value
    return {name, hasWildcard}
  }

  // Fallback
  return {name: expr, hasWildcard: false}
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
        'HeadObject': 's3:HeadObject',
        'AbortMultipartUpload': 's3:AbortMultipartUpload',
        'ListMultipartUploadParts': 's3:ListMultipartUploadParts'
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
        'Subscribe': 'sns:Subscribe',
        'Unsubscribe': 'sns:Unsubscribe',
        'ListSubscriptionsByTopic': 'sns:ListSubscriptionsByTopic',
        'CreatePlatformEndpoint': 'sns:CreatePlatformEndpoint',
        'DeleteEndpoint': 'sns:DeleteEndpoint'
      },
      'EventBridgeOperation': {
        'PutEvents': 'events:PutEvents'
      }
    }
    return opMaps[operationType]?.[opName] || expr
  }
  // Handle string literal
  const stringMatch = expr.match(/['"`]([^'"`]+)['"`]/)
  return stringMatch ? stringMatch[1] : expr
}

/**
 * Extract Lambda name from file path
 */
function extractLambdaName(filePath: string): string {
  const match = filePath.match(/lambdas\/([^/]+)\//)
  return match ? match[1] : 'Unknown'
}

/**
 * Extract RequiresXxx decorators from vendor wrapper class methods
 */
function extractVendorPermissions(
  project: Project,
  terraformResources: TerraformResourceManifest | null
): Record<string, VendorMethodPermission> {
  const vendorPermissions: Record<string, VendorMethodPermission> = {}

  // Scan vendor wrapper files
  const vendorPattern = join(projectRoot, 'src/lib/vendor/AWS/*.ts')
  project.addSourceFilesAtPaths(vendorPattern)

  const vendorFiles = project.getSourceFiles().filter((f) =>
    f.getFilePath().includes('src/lib/vendor/AWS/')
  )

  console.log(`Found ${vendorFiles.length} vendor wrapper files`)

  for (const file of vendorFiles) {
    const filePath = file.getFilePath()
    const relativePath = relative(projectRoot, filePath)

    for (const classDecl of file.getClasses()) {
      const className = classDecl.getName()
      if (!className?.endsWith('Vendor')) continue // Only process Vendor classes

      for (const method of classDecl.getStaticMethods()) {
        const methodName = method.getName()

        // Find decorator matching our patterns
        const decorator = method.getDecorators().find((d) =>
          ['RequiresSNS', 'RequiresS3', 'RequiresSQS', 'RequiresEventBridge'].includes(d.getName())
        )

        if (!decorator) continue

        // Parse decorator arguments: @RequiresSNS(SNSTopicResource.PushNotifications, [SNSOperation.Subscribe])
        const args = decorator.getArguments()
        if (args.length < 2) continue

        const resourceExpr = args[0].getText()
        const resourceValue = extractResourceValue(resourceExpr)
        const service = getServiceFromDecorator(decorator.getName())
        const arnRef = getArnRef(service, resourceValue.name, terraformResources)

        // Extract operations from array argument
        const operations: string[] = []
        const opsArray = args[1].asKind(SyntaxKind.ArrayLiteralExpression)
        if (opsArray) {
          for (const opElement of opsArray.getElements()) {
            operations.push(extractOperation(opElement.getText()))
          }
        }

        const key = `${className}.${methodName}`
        vendorPermissions[key] = {
          className,
          methodName,
          filePath: relativePath,
          permissions: [{
            service,
            resource: resourceValue.name,
            hasWildcard: resourceValue.hasWildcard,
            arnRef,
            operations
          }]
        }

        console.log(`  ${relativePath}: ${className}.${methodName} -> ${service}:${resourceValue.name}`)
      }
    }
  }

  return vendorPermissions
}

/**
 * Extract @RequiresServices from Lambda handlers (legacy support)
 */
function extractLambdaLegacyPermissions(
  project: Project,
  terraformResources: TerraformResourceManifest | null
): Record<string, LambdaServicePermissions> {
  const lambdaPermissions: Record<string, LambdaServicePermissions> = {}

  // Add Lambda handler files
  const lambdaPattern = join(projectRoot, 'src/lambdas/*/src/index.ts')
  project.addSourceFilesAtPaths(lambdaPattern)

  const lambdaFiles = project.getSourceFiles().filter((f) =>
    f.getFilePath().includes('src/lambdas/') && f.getFilePath().endsWith('/src/index.ts')
  )

  console.log(`Found ${lambdaFiles.length} Lambda handler files`)

  for (const sourceFile of lambdaFiles) {
    const filePath = sourceFile.getFilePath()
    const lambdaName = extractLambdaName(filePath)

    // Find classes with @RequiresServices decorator
    for (const classDecl of sourceFile.getClasses()) {
      const decorator = classDecl.getDecorator('RequiresServices')
      if (!decorator) continue

      console.log(`  ${lambdaName}: Found @RequiresServices (legacy)`)

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
            let service: ServiceType = 's3'
            let resourceValue = {name: '', hasWildcard: false}
            const operations: string[] = []

            for (const prop of serviceObj.getProperties()) {
              if (prop.isKind(SyntaxKind.PropertyAssignment)) {
                const propName = prop.getName()
                const initText = prop.getInitializer()?.getText() || ''

                if (propName === 'service') {
                  service = extractServiceType(initText)
                } else if (propName === 'resource') {
                  resourceValue = extractResourceValue(initText)
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

            if (resourceValue.name && operations.length > 0) {
              const arnRef = getArnRef(service, resourceValue.name, terraformResources)
              services.push({
                service,
                resource: resourceValue.name,
                hasWildcard: resourceValue.hasWildcard,
                arnRef,
                operations
              })
            }
          }
        }
      }

      if (services.length > 0) {
        lambdaPermissions[lambdaName] = {services}
      }
    }
  }

  return lambdaPermissions
}

/**
 * Trace Lambda dependencies and aggregate permissions from vendor files
 */
function traceLambdaDependencies(
  graph: DependencyGraph,
  vendorPermissions: Record<string, VendorMethodPermission>,
  terraformResources: TerraformResourceManifest | null
): Record<string, LambdaServicePermissions> {
  const lambdaPermissions: Record<string, LambdaServicePermissions> = {}

  // Find all Lambda entry points (graph.json uses paths without .ts extension)
  const lambdaEntryPoints = Object.keys(graph.transitiveDependencies || {}).filter((path) =>
    path.includes('src/lambdas/') && path.endsWith('/src/index.ts')
  )

  console.log(`\nTracing dependencies for ${lambdaEntryPoints.length} Lambdas...`)

  for (const lambdaPath of lambdaEntryPoints) {
    const lambdaName = extractLambdaName(lambdaPath)
    const transitiveImports = graph.transitiveDependencies[lambdaPath] || []

    // Find all vendor files in transitive imports
    // graph.json uses paths without .ts extension: "src/lib/vendor/AWS/SNS"
    const vendorImports = transitiveImports.filter((p) =>
      p.includes('src/lib/vendor/AWS/')
    )

    if (vendorImports.length === 0) continue

    // Aggregate permissions from all vendor methods in imported files
    const allPermissions: ServicePermission[] = []

    for (const vendorFile of vendorImports) {
      // graph.json paths don't have .ts extension, vendor permissions do
      // Normalize by comparing without extension or adding .ts
      const vendorWithExt = vendorFile.endsWith('.ts') ? vendorFile : `${vendorFile}.ts`

      for (const methodPerm of Object.values(vendorPermissions)) {
        // Match by file path (normalize both to same format)
        const permPath = methodPerm.filePath
        if (permPath === vendorWithExt || permPath === vendorFile) {
          allPermissions.push(...methodPerm.permissions)
        }
      }
    }

    if (allPermissions.length > 0) {
      // Deduplicate permissions by service + resource + operations
      const deduped = deduplicatePermissions(allPermissions, terraformResources)
      lambdaPermissions[lambdaName] = {services: deduped}
      console.log(`  ${lambdaName}: ${deduped.length} service permission(s) from vendor imports`)
    }
  }

  return lambdaPermissions
}

/**
 * Deduplicate and merge permissions with same service/resource
 */
function deduplicatePermissions(
  permissions: ServicePermission[],
  terraformResources: TerraformResourceManifest | null
): ServicePermission[] {
  const merged = new Map<string, ServicePermission>()
  for (const perm of permissions) {
    const key = `${perm.service}:${perm.resource}:${perm.hasWildcard}`
    const existing = merged.get(key)
    if (existing) {
      // Merge operations
      const allOps = new Set([...existing.operations, ...perm.operations])
      existing.operations = Array.from(allOps).sort()
    } else {
      merged.set(key, {...perm, arnRef: getArnRef(perm.service, perm.resource, terraformResources)})
    }
  }
  return Array.from(merged.values())
}

/**
 * Merge legacy and vendor-traced permissions
 */
function mergePermissions(
  legacyPerms: Record<string, LambdaServicePermissions>,
  vendorPerms: Record<string, LambdaServicePermissions>,
  terraformResources: TerraformResourceManifest | null
): Record<string, LambdaServicePermissions> {
  const merged: Record<string, LambdaServicePermissions> = {}

  // Get all Lambda names
  const allLambdas = new Set([...Object.keys(legacyPerms), ...Object.keys(vendorPerms)])

  for (const lambdaName of allLambdas) {
    const legacy = legacyPerms[lambdaName]?.services || []
    const vendor = vendorPerms[lambdaName]?.services || []

    const combined = deduplicatePermissions([...legacy, ...vendor], terraformResources)
    if (combined.length > 0) {
      merged[lambdaName] = {services: combined}
    }
  }

  return merged
}

/**
 * Main extraction function
 */
async function extractPermissions(): Promise<ServicePermissionsManifest> {
  console.log('Loading TypeScript project...')

  const terraformResources = loadTerraformResources()
  const graph = loadDependencyGraph()

  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  })

  // Step 1: Extract vendor wrapper permissions
  console.log('\n=== Extracting Vendor Wrapper Permissions ===')
  const vendorPermissions = extractVendorPermissions(project, terraformResources)
  console.log(`Found ${Object.keys(vendorPermissions).length} decorated vendor methods`)

  // Step 2: Extract legacy @RequiresServices from Lambda handlers
  console.log('\n=== Extracting Legacy Lambda Permissions ===')
  const legacyPermissions = extractLambdaLegacyPermissions(project, terraformResources)
  console.log(`Found ${Object.keys(legacyPermissions).length} Lambdas with @RequiresServices`)

  // Step 3: Trace Lambda dependencies and aggregate vendor permissions
  let vendorTracedPermissions: Record<string, LambdaServicePermissions> = {}
  if (graph) {
    console.log('\n=== Tracing Lambda Dependencies ===')
    vendorTracedPermissions = traceLambdaDependencies(graph, vendorPermissions, terraformResources)
  }

  // Step 4: Merge legacy and vendor-traced permissions
  console.log('\n=== Merging Permissions ===')
  const mergedPermissions = mergePermissions(legacyPermissions, vendorTracedPermissions, terraformResources)

  return {
    lambdas: mergedPermissions,
    vendorMethods: vendorPermissions,
    generatedAt: new Date().toISOString()
  }
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

    console.log(`\n=== Generated ${outputPath} ===`)
    console.log(`Found permissions for ${Object.keys(manifest.lambdas).length} Lambdas:`)

    for (const [name, perms] of Object.entries(manifest.lambdas)) {
      const serviceCount = perms.services.length
      console.log(`  - ${name}: ${serviceCount} service(s)`)
      for (const svc of perms.services) {
        const wildcard = svc.hasWildcard ? '/*' : ''
        console.log(`      ${svc.service}: ${svc.resource}${wildcard} [${svc.operations.join(', ')}]`)
        console.log(`        arnRef: ${svc.arnRef}`)
      }
    }

    console.log(`\nVendor methods with permissions: ${Object.keys(manifest.vendorMethods).length}`)
  } catch (error) {
    console.error('Failed to extract permissions:', error)
    process.exit(1)
  }
}

main()
