/**
 * DynamoDB Permission Extraction Script
 *
 * Uses ts-morph to extract `@RequiresDynamoDB` decorator metadata from Lambda handlers
 * and generates a JSON manifest for downstream tooling.
 *
 * Output: build/dynamodb-permissions.json
 *
 * Usage: pnpm run extract:dynamodb-permissions
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs'
import {dirname, join} from 'path'
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

interface DynamoDBPermissionsManifest {
  lambdas: Record<string, LambdaDynamoDBPermissions>
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
 * Main extraction function
 */
async function extractPermissions(): Promise<DynamoDBPermissionsManifest> {
  console.log('Loading TypeScript project...')

  const terraformResources = loadTerraformResources()

  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  })

  // Add only Lambda handler files
  const lambdaPattern = join(projectRoot, 'src/lambdas/*/src/index.ts')
  project.addSourceFilesAtPaths(lambdaPattern)

  console.log(`Found ${project.getSourceFiles().length} Lambda handler files`)

  const manifest: DynamoDBPermissionsManifest = {
    lambdas: {},
    generatedAt: new Date().toISOString()
  }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath()
    const lambdaName = extractLambdaName(filePath)

    // Find classes with @RequiresDynamoDB decorator
    for (const classDecl of sourceFile.getClasses()) {
      const decorator = classDecl.getDecorator('RequiresDynamoDB')
      if (!decorator) continue

      console.log(`Processing ${lambdaName}...`)

      // Get decorator arguments
      const args = decorator.getArguments()
      if (args.length === 0) continue

      // Parse the tables array from the decorator argument
      const tables: DynamoDBPermission[] = []

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
              tables.push({
                table: tableName,
                arnRef,
                operations
              })
            }
          }
        }
      }

      if (tables.length > 0) {
        manifest.lambdas[lambdaName] = {tables}
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
    const outputPath = join(buildDir, 'dynamodb-permissions.json')
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

    console.log(`\nGenerated ${outputPath}`)
    console.log(`Found permissions for ${Object.keys(manifest.lambdas).length} Lambdas:`)

    for (const [name, perms] of Object.entries(manifest.lambdas)) {
      const tableCount = perms.tables.length
      console.log(`  - ${name}: ${tableCount} table(s)`)
      for (const tbl of perms.tables) {
        console.log(`      ${tbl.table} [${tbl.operations.join(', ')}]`)
        console.log(`        arnRef: ${tbl.arnRef}`)
      }
    }
  } catch (error) {
    console.error('Failed to extract permissions:', error)
    process.exit(1)
  }
}

main()
