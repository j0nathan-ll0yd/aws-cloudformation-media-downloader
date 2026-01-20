/**
 * DynamoDB Permission Extraction Script
 *
 * Uses ts-morph to extract `@RequiresDynamoDB` decorator metadata from:
 * 1. Powertools vendor wrapper classes (e.g., IdempotencyVendor)
 * 2. Lambda handlers (legacy support)
 *
 * The script:
 * 1. Parses Powertools vendor classes for @RequiresDynamoDB method decorators
 * 2. Uses build/graph.json to trace Lambda dependencies
 * 3. Aggregates permissions from all Powertools files each Lambda imports
 * 4. Generates a JSON manifest for Terraform IAM policy generation
 *
 * Output: build/dynamodb-permissions.json
 *
 * Usage: pnpm run extract:dynamodb-permissions
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

interface DynamoDBPermission {
  table: string
  arnRef: string
  operations: string[]
}

interface LambdaDynamoDBPermissions {
  tables: DynamoDBPermission[]
}

interface VendorMethodPermission {
  className: string
  methodName: string
  filePath: string
  permissions: DynamoDBPermission[]
}

interface DynamoDBPermissionsManifest {
  lambdas: Record<string, LambdaDynamoDBPermissions>
  vendorMethods: Record<string, VendorMethodPermission>
  generatedAt: string
}

interface TerraformResourceEntry {
  name: string
  terraformId: string
  arnRef: string
}

interface TerraformResourceManifest {
  dynamodbTables: TerraformResourceEntry[]
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
    console.warn('Run: pnpm run generate:graph first to generate the dependency graph.')
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
 * Get Terraform ARN reference for a DynamoDB table
 */
function getArnRef(tableName: string, terraformResources: TerraformResourceManifest | null): string {
  if (!terraformResources) {
    return `aws_dynamodb_table.${tableName}.arn`
  }
  const entry = terraformResources.dynamodbTables?.find((r) => r.name === tableName)
  return entry?.arnRef || `aws_dynamodb_table.${tableName}.arn`
}

/**
 * Extract table name from expression like DynamoDBResource.IdempotencyTable
 */
function extractTableName(expr: string): string {
  // Handle enum value: DynamoDBResource.IdempotencyTable
  const enumMatch = expr.match(/DynamoDBResource\.(\w+)/)
  if (enumMatch) {
    return enumMatch[1]
  }

  // Handle string literal: 'IdempotencyTable'
  const stringMatch = expr.match(/['"`]([^'"`]+)['"`]/)
  if (stringMatch) {
    return stringMatch[1]
  }

  return expr
}

/**
 * Extract operation from expression like DynamoDBOperation.GetItem
 */
function extractOperation(expr: string): string {
  // Match enum patterns like DynamoDBOperation.GetItem
  const enumMatch = expr.match(/DynamoDBOperation\.(\w+)/)
  if (enumMatch) {
    const opName = enumMatch[1]
    const opMap: Record<string, string> = {
      'GetItem': 'dynamodb:GetItem',
      'PutItem': 'dynamodb:PutItem',
      'UpdateItem': 'dynamodb:UpdateItem',
      'DeleteItem': 'dynamodb:DeleteItem',
      'Query': 'dynamodb:Query',
      'Scan': 'dynamodb:Scan',
      'BatchGetItem': 'dynamodb:BatchGetItem',
      'BatchWriteItem': 'dynamodb:BatchWriteItem'
    }
    return opMap[opName] || `dynamodb:${opName}`
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
 * Extract @RequiresDynamoDB decorators from Powertools vendor wrapper class methods
 */
function extractVendorPermissions(
  project: Project,
  terraformResources: TerraformResourceManifest | null
): Record<string, VendorMethodPermission> {
  const vendorPermissions: Record<string, VendorMethodPermission> = {}

  // Scan Powertools vendor wrapper files
  const powertoolsPattern = join(projectRoot, 'src/lib/vendor/Powertools/*.ts')
  project.addSourceFilesAtPaths(powertoolsPattern)

  const powertoolsFiles = project.getSourceFiles().filter((f) => f.getFilePath().includes('src/lib/vendor/Powertools/'))

  console.log(`Found ${powertoolsFiles.length} Powertools vendor wrapper files`)

  for (const file of powertoolsFiles) {
    const filePath = file.getFilePath()
    const relativePath = relative(projectRoot, filePath)

    for (const classDecl of file.getClasses()) {
      const className = classDecl.getName()
      if (!className?.endsWith('Vendor')) continue // Only process Vendor classes

      for (const method of classDecl.getStaticMethods()) {
        const methodName = method.getName()
        const decorator = method.getDecorator('RequiresDynamoDB')

        if (!decorator) continue

        // Parse decorator arguments: @RequiresDynamoDB([{table: ..., operations: [...]}])
        const args = decorator.getArguments()
        if (args.length < 1) continue

        const permissions: DynamoDBPermission[] = []

        const arrayLiteral = args[0].asKind(SyntaxKind.ArrayLiteralExpression)
        if (arrayLiteral) {
          for (const element of arrayLiteral.getElements()) {
            const tableObj = element.asKind(SyntaxKind.ObjectLiteralExpression)
            if (tableObj) {
              let tableName = ''
              const operations: string[] = []

              for (const prop of tableObj.getProperties()) {
                if (prop.isKind(SyntaxKind.PropertyAssignment)) {
                  const propName = prop.getName()
                  const initText = prop.getInitializer()?.getText() || ''

                  if (propName === 'table') {
                    tableName = extractTableName(initText)
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

              if (tableName && operations.length > 0) {
                const arnRef = getArnRef(tableName, terraformResources)
                permissions.push({table: tableName, arnRef, operations})
              }
            }
          }
        }

        if (permissions.length > 0) {
          const key = `${className}.${methodName}`
          vendorPermissions[key] = {
            className,
            methodName,
            filePath: relativePath,
            permissions
          }
          console.log(`  ${relativePath}: ${className}.${methodName} -> ${permissions.map((p) => p.table).join(', ')}`)
        }
      }
    }
  }

  return vendorPermissions
}

/**
 * Extract legacy @RequiresDynamoDB from Lambda handlers
 */
function extractLambdaLegacyPermissions(
  project: Project,
  terraformResources: TerraformResourceManifest | null
): Record<string, LambdaDynamoDBPermissions> {
  const lambdaPermissions: Record<string, LambdaDynamoDBPermissions> = {}

  // Add Lambda handler files
  const lambdaPattern = join(projectRoot, 'src/lambdas/*/src/index.ts')
  project.addSourceFilesAtPaths(lambdaPattern)

  const lambdaFiles = project
    .getSourceFiles()
    .filter((f) => f.getFilePath().includes('src/lambdas/') && f.getFilePath().endsWith('/src/index.ts'))

  console.log(`Found ${lambdaFiles.length} Lambda handler files`)

  for (const sourceFile of lambdaFiles) {
    const filePath = sourceFile.getFilePath()
    const lambdaName = extractLambdaName(filePath)

    // Find classes with @RequiresDynamoDB decorator (legacy)
    for (const classDecl of sourceFile.getClasses()) {
      const tables: DynamoDBPermission[] = []

      // Check for @RequiresDynamoDB([...]) - explicit DynamoDB permissions
      const dynamodbDecorator = classDecl.getDecorator('RequiresDynamoDB')
      if (dynamodbDecorator) {
        console.log(`  ${lambdaName}: Found @RequiresDynamoDB (legacy)`)

        // Get decorator arguments
        const args = dynamodbDecorator.getArguments()
        if (args.length > 0) {
          const arrayLiteral = args[0].asKind(SyntaxKind.ArrayLiteralExpression)
          if (arrayLiteral) {
            for (const element of arrayLiteral.getElements()) {
              const tableObj = element.asKind(SyntaxKind.ObjectLiteralExpression)
              if (tableObj) {
                let tableName = ''
                const operations: string[] = []

                for (const prop of tableObj.getProperties()) {
                  if (prop.isKind(SyntaxKind.PropertyAssignment)) {
                    const propName = prop.getName()
                    const initText = prop.getInitializer()?.getText() || ''

                    if (propName === 'table') {
                      tableName = extractTableName(initText)
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

                if (tableName && operations.length > 0) {
                  const arnRef = getArnRef(tableName, terraformResources)
                  tables.push({table: tableName, arnRef, operations})
                }
              }
            }
          }
        }
      }

      if (tables.length > 0) {
        lambdaPermissions[lambdaName] = {tables}
      }
    }
  }

  return lambdaPermissions
}

/**
 * Trace Lambda dependencies and aggregate permissions from Powertools vendor files
 */
function traceLambdaDependencies(
  graph: DependencyGraph,
  vendorPermissions: Record<string, VendorMethodPermission>,
  terraformResources: TerraformResourceManifest | null
): Record<string, LambdaDynamoDBPermissions> {
  const lambdaPermissions: Record<string, LambdaDynamoDBPermissions> = {}

  // Find all Lambda entry points
  const lambdaEntryPoints = Object.keys(graph.transitiveDependencies || {}).filter(
    (path) => path.includes('src/lambdas/') && path.endsWith('/src/index.ts')
  )

  console.log(`\nTracing dependencies for ${lambdaEntryPoints.length} Lambdas...`)

  for (const lambdaPath of lambdaEntryPoints) {
    const lambdaName = extractLambdaName(lambdaPath)
    const transitiveImports = graph.transitiveDependencies[lambdaPath] || []

    // Find all Powertools vendor files in transitive imports
    const powertoolsImports = transitiveImports.filter((p) => p.includes('src/lib/vendor/Powertools/'))

    if (powertoolsImports.length === 0) continue

    // Aggregate permissions from all vendor methods in imported files
    const allPermissions: DynamoDBPermission[] = []

    for (const vendorFile of powertoolsImports) {
      // Normalize paths for comparison (with/without .ts extension)
      const vendorWithExt = vendorFile.endsWith('.ts') ? vendorFile : `${vendorFile}.ts`

      for (const methodPerm of Object.values(vendorPermissions)) {
        if (methodPerm.filePath === vendorWithExt || methodPerm.filePath === vendorFile) {
          allPermissions.push(...methodPerm.permissions)
        }
      }
    }

    if (allPermissions.length > 0) {
      // Deduplicate permissions by table
      const deduped = deduplicatePermissions(allPermissions, terraformResources)
      lambdaPermissions[lambdaName] = {tables: deduped}
      console.log(`  ${lambdaName}: ${deduped.length} DynamoDB table(s) from Powertools imports`)
    }
  }

  return lambdaPermissions
}

/**
 * Deduplicate and merge permissions with same table
 */
function deduplicatePermissions(
  permissions: DynamoDBPermission[],
  terraformResources: TerraformResourceManifest | null
): DynamoDBPermission[] {
  const merged = new Map<string, DynamoDBPermission>()
  for (const perm of permissions) {
    const key = perm.table
    const existing = merged.get(key)
    if (existing) {
      // Merge operations
      const allOps = new Set([...existing.operations, ...perm.operations])
      existing.operations = Array.from(allOps).sort()
    } else {
      merged.set(key, {...perm, arnRef: getArnRef(perm.table, terraformResources)})
    }
  }
  return Array.from(merged.values())
}

/**
 * Merge legacy and vendor-traced permissions
 */
function mergePermissions(
  legacyPerms: Record<string, LambdaDynamoDBPermissions>,
  vendorPerms: Record<string, LambdaDynamoDBPermissions>,
  terraformResources: TerraformResourceManifest | null
): Record<string, LambdaDynamoDBPermissions> {
  const merged: Record<string, LambdaDynamoDBPermissions> = {}

  // Get all Lambda names
  const allLambdas = new Set([...Object.keys(legacyPerms), ...Object.keys(vendorPerms)])

  for (const lambdaName of allLambdas) {
    const legacy = legacyPerms[lambdaName]?.tables || []
    const vendor = vendorPerms[lambdaName]?.tables || []

    const combined = deduplicatePermissions([...legacy, ...vendor], terraformResources)
    if (combined.length > 0) {
      merged[lambdaName] = {tables: combined}
    }
  }

  return merged
}

/**
 * Main extraction function
 */
async function extractPermissions(): Promise<DynamoDBPermissionsManifest> {
  console.log('Loading TypeScript project...')

  const terraformResources = loadTerraformResources()
  const graph = loadDependencyGraph()

  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  })

  // Step 1: Extract Powertools vendor wrapper permissions
  console.log('\n=== Extracting Powertools Vendor Wrapper Permissions ===')
  const vendorPermissions = extractVendorPermissions(project, terraformResources)
  console.log(`Found ${Object.keys(vendorPermissions).length} decorated vendor methods`)

  // Step 2: Extract legacy @RequiresDynamoDB from Lambda handlers
  console.log('\n=== Extracting Legacy Lambda Permissions ===')
  const legacyPermissions = extractLambdaLegacyPermissions(project, terraformResources)
  console.log(`Found ${Object.keys(legacyPermissions).length} Lambdas with @RequiresDynamoDB`)

  // Step 3: Trace Lambda dependencies and aggregate vendor permissions
  let vendorTracedPermissions: Record<string, LambdaDynamoDBPermissions> = {}
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
    const outputPath = join(buildDir, 'dynamodb-permissions.json')
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

    console.log(`\n=== Generated ${outputPath} ===`)
    console.log(`Found permissions for ${Object.keys(manifest.lambdas).length} Lambdas:`)

    for (const [name, perms] of Object.entries(manifest.lambdas)) {
      const tableCount = perms.tables.length
      console.log(`  - ${name}: ${tableCount} table(s)`)
      for (const tbl of perms.tables) {
        console.log(`      ${tbl.table} [${tbl.operations.join(', ')}]`)
        console.log(`        arnRef: ${tbl.arnRef}`)
      }
    }

    console.log(`\nVendor methods with permissions: ${Object.keys(manifest.vendorMethods).length}`)
  } catch (error) {
    console.error('Failed to extract permissions:', error)
    process.exit(1)
  }
}

main()
