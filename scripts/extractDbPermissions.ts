/**
 * Database Permission Extraction Script
 *
 * Uses ts-morph to extract @RequiresDatabase decorator metadata from Lambda handlers
 * and generates a JSON manifest for downstream tooling.
 *
 * Output: build/db-permissions.json
 *
 * Usage: pnpm run extract:db-permissions
 *
 * @see docs/wiki/Infrastructure/Database-Permissions.md
 */
import {existsSync, mkdirSync, writeFileSync} from 'fs'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'
import {Project, SyntaxKind} from 'ts-morph'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

interface TablePermission {
  table: string
  operations: string[]
}

interface LambdaPermissions {
  tables: TablePermission[]
  computedAccessLevel: 'readonly' | 'readwrite' | 'admin'
}

interface PermissionsManifest {
  lambdas: Record<string, LambdaPermissions>
  generatedAt: string
}

/**
 * Compute access level from declared operations.
 * - readonly: Only SELECT operations
 * - readwrite: Any INSERT, UPDATE, or DELETE operations
 * - admin: All operations on all tables (detected by having all ops on >5 tables)
 */
function computeAccessLevel(tables: TablePermission[]): 'readonly' | 'readwrite' | 'admin' {
  const hasAllOps = tables.every(t =>
    ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].every(op => t.operations.includes(op))
  )
  if (hasAllOps && tables.length >= 5) {
    return 'admin'
  }
  const hasWrite = tables.some(t =>
    t.operations.some(op => ['INSERT', 'UPDATE', 'DELETE'].includes(op))
  )
  return hasWrite ? 'readwrite' : 'readonly'
}

/**
 * Extract table enum value from expression like DatabaseTable.Users
 */
function extractTableName(expr: string): string {
  const match = expr.match(/DatabaseTable\.(\w+)/)
  if (match) {
    // Convert enum value to snake_case table name
    const tableMap: Record<string, string> = {
      'Users': 'users',
      'Files': 'files',
      'FileDownloads': 'file_downloads',
      'Devices': 'devices',
      'Sessions': 'sessions',
      'Accounts': 'accounts',
      'VerificationTokens': 'verification_tokens',
      'UserFiles': 'user_files',
      'UserDevices': 'user_devices'
    }
    return tableMap[match[1]] || match[1].toLowerCase()
  }
  return expr
}

/**
 * Extract operation from expression like DatabaseOperation.Select
 * Returns array since 'All' expands to multiple operations
 */
function extractOperations(expr: string): string[] {
  const match = expr.match(/DatabaseOperation\.(\w+)/)
  if (match) {
    const op = match[1].toUpperCase()
    // Expand ALL to individual operations
    if (op === 'ALL') {
      return ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    }
    return [op]
  }
  return [expr.toUpperCase()]
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
async function extractPermissions(): Promise<PermissionsManifest> {
  console.log('Loading TypeScript project...')

  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  })

  // Add only Lambda handler files
  const lambdaPattern = join(projectRoot, 'src/lambdas/*/src/index.ts')
  project.addSourceFilesAtPaths(lambdaPattern)

  console.log(`Found ${project.getSourceFiles().length} Lambda handler files`)

  const manifest: PermissionsManifest = {
    lambdas: {},
    generatedAt: new Date().toISOString()
  }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath()
    const lambdaName = extractLambdaName(filePath)

    // Find classes with @RequiresDatabase decorator
    for (const classDecl of sourceFile.getClasses()) {
      const decorator = classDecl.getDecorator('RequiresDatabase')
      if (!decorator) continue

      console.log(`Processing ${lambdaName}...`)

      // Get decorator arguments
      const args = decorator.getArguments()
      if (args.length === 0) continue

      // Parse the tables array from the decorator argument
      const tables: TablePermission[] = []

      // Extract tables array using AST
      const objLiteral = args[0].asKind(SyntaxKind.ObjectLiteralExpression)
      if (objLiteral) {
        for (const prop of objLiteral.getProperties()) {
          if (prop.isKind(SyntaxKind.PropertyAssignment)) {
            const name = prop.getName()

            if (name === 'tables') {
              const arrayLiteral = prop.getInitializer()?.asKind(SyntaxKind.ArrayLiteralExpression)
              if (arrayLiteral) {
                for (const element of arrayLiteral.getElements()) {
                  const tableObj = element.asKind(SyntaxKind.ObjectLiteralExpression)
                  if (tableObj) {
                    let tableName = ''
                    const operations: string[] = []

                    for (const tableProp of tableObj.getProperties()) {
                      if (tableProp.isKind(SyntaxKind.PropertyAssignment)) {
                        const propName = tableProp.getName()
                        const initText = tableProp.getInitializer()?.getText() || ''

                        if (propName === 'table') {
                          tableName = extractTableName(initText)
                        } else if (propName === 'operations') {
                          const opsArray = tableProp.getInitializer()?.asKind(SyntaxKind.ArrayLiteralExpression)
                          if (opsArray) {
                            for (const opElement of opsArray.getElements()) {
                              // extractOperations returns array (handles All -> individual ops)
                              operations.push(...extractOperations(opElement.getText()))
                            }
                          }
                        }
                      }
                    }

                    if (tableName && operations.length > 0) {
                      tables.push({table: tableName, operations})
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (tables.length > 0) {
        manifest.lambdas[lambdaName] = {
          tables,
          computedAccessLevel: computeAccessLevel(tables)
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
    const outputPath = join(buildDir, 'db-permissions.json')
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

    console.log(`\nGenerated ${outputPath}`)
    console.log(`Found permissions for ${Object.keys(manifest.lambdas).length} Lambdas:`)

    for (const [name, perms] of Object.entries(manifest.lambdas)) {
      const tableCount = perms.tables.length
      console.log(`  - ${name}: ${perms.computedAccessLevel} (${tableCount} tables)`)
    }
  } catch (error) {
    console.error('Failed to extract permissions:', error)
    process.exit(1)
  }
}

main()
