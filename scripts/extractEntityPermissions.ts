/**
 * Entity Permission Extraction Script
 *
 * Phase 8.3: Function-Level Database Permission Extraction
 *
 * Uses ts-morph to extract @RequiresTable decorator metadata from entity query classes
 * and traces Lambda dependencies to determine database access requirements.
 *
 * The script:
 * 1. Parses entity query classes for @RequiresTable method decorators
 * 2. Builds method → permission map (e.g., UserQueries.getUser → {users, SELECT})
 * 3. Uses build/graph.json to trace Lambda dependencies
 * 4. Handles barrel import expansion (src/entities/queries → all query files)
 * 5. Aggregates permissions from all entity query methods each Lambda transitively imports
 * 6. Generates a JSON manifest for database role permission generation
 *
 * Output: build/entity-permissions.json
 *
 * Usage: pnpm run extract:entity-permissions
 *
 * @see docs/wiki/Infrastructure/Lambda-Decorators.md
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs'
import {dirname, join, relative, resolve} from 'path'
import {fileURLToPath} from 'url'
import {Project, SyntaxKind} from 'ts-morph'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

interface TablePermission {
  table: string
  operations: string[]
}

interface EntityMethodPermission {
  className: string
  methodName: string
  filePath: string
  permissions: TablePermission[]
}

interface LambdaEntityPermissions {
  tables: TablePermission[]
  computedAccessLevel: 'readonly' | 'readwrite' | 'admin'
  sourceFiles: string[]
}

interface EntityPermissionsManifest {
  lambdas: Record<string, LambdaEntityPermissions>
  entityMethods: Record<string, EntityMethodPermission>
  generatedAt: string
}

interface NamedImport {
  name: string
  isTypeOnly: boolean
}

interface ImportEntry {
  path: string
  namedImports?: NamedImport[]
}

interface DependencyGraph {
  files: Record<string, {imports: ImportEntry[]}>
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
 * Build a map from exported function name to source file path.
 * Parses barrel re-exports like: export { getUser } from './userQueries'
 */
function buildBarrelExportMap(project: Project, barrelPath: string): Record<string, string> {
  const absolutePath = join(projectRoot, barrelPath)
  const barrelFile = project.getSourceFile(absolutePath)
  if (!barrelFile) {
    console.warn(`Warning: Could not find barrel file at ${barrelPath}`)
    return {}
  }

  const exportMap: Record<string, string> = {}
  const exportDecls = barrelFile.getExportDeclarations()

  for (const exportDecl of exportDecls) {
    const moduleSpecifier = exportDecl.getModuleSpecifierValue()
    if (!moduleSpecifier) continue

    // Resolve relative path to absolute
    const sourceDir = dirname(barrelFile.getFilePath())
    let resolvedPath = resolve(sourceDir, moduleSpecifier)
    if (!resolvedPath.endsWith('.ts')) {
      resolvedPath += '.ts'
    }
    const relativePath = relative(projectRoot, resolvedPath)

    // Map each named export to its source file
    const namedExports = exportDecl.getNamedExports()
    for (const namedExport of namedExports) {
      const exportName = namedExport.getName()
      // Skip type exports
      if (!namedExport.isTypeOnly()) {
        exportMap[exportName] = relativePath
      }
    }
  }

  return exportMap
}

/**
 * Build a map from exported function name to ClassName.methodName
 * Parses patterns like: export const getUser = UserQueries.getUser.bind(UserQueries)
 */
function buildFunctionToMethodMap(project: Project, entityFilePaths: string[]): Record<string, string> {
  const functionToMethod: Record<string, string> = {}

  for (const filePath of entityFilePaths) {
    const absolutePath = join(projectRoot, filePath)
    const sourceFile = project.getSourceFile(absolutePath)
    if (!sourceFile) continue

    // Find exported variable declarations
    const exportedVars = sourceFile.getVariableStatements().filter((vs) => vs.isExported())

    for (const varStmt of exportedVars) {
      for (const decl of varStmt.getDeclarations()) {
        const funcName = decl.getName()
        const initializer = decl.getInitializer()
        if (!initializer) continue

        // Match pattern: ClassName.methodName.bind(ClassName)
        const initText = initializer.getText()
        const match = initText.match(/^(\w+)\.(\w+)\.bind\(/)
        if (match) {
          const [, className, methodName] = match
          functionToMethod[funcName] = `${className}.${methodName}`
        }
      }
    }
  }

  return functionToMethod
}

/**
 * Extract table name from expression like DatabaseTable.Users
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
 * Compute access level from declared operations.
 * - readonly: Only SELECT operations
 * - readwrite: Any INSERT, UPDATE, or DELETE operations
 * - admin: All operations on all tables (detected by having all ops on >=5 tables)
 */
function computeAccessLevel(tables: TablePermission[]): 'readonly' | 'readwrite' | 'admin' {
  const hasAllOps = tables.every((t) =>
    ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].every((op) => t.operations.includes(op))
  )
  if (hasAllOps && tables.length >= 5) {
    return 'admin'
  }
  const hasWrite = tables.some((t) => t.operations.some((op) => ['INSERT', 'UPDATE', 'DELETE'].includes(op)))
  return hasWrite ? 'readwrite' : 'readonly'
}

/**
 * Extract @RequiresTable decorators from entity query class methods
 */
function extractEntityPermissions(project: Project): Record<string, EntityMethodPermission> {
  const entityPermissions: Record<string, EntityMethodPermission> = {}

  // Scan entity query files
  const entityPattern = join(projectRoot, 'src/entities/queries/*.ts')
  project.addSourceFilesAtPaths(entityPattern)

  const entityFiles = project
    .getSourceFiles()
    .filter((f) => f.getFilePath().includes('src/entities/queries/') && !f.getFilePath().endsWith('index.ts'))

  console.log(`Found ${entityFiles.length} entity query files`)

  for (const file of entityFiles) {
    const filePath = file.getFilePath()
    const relativePath = relative(projectRoot, filePath)

    for (const classDecl of file.getClasses()) {
      const className = classDecl.getName()
      if (!className?.endsWith('Queries') && !className?.endsWith('Operations')) continue

      for (const method of classDecl.getStaticMethods()) {
        const methodName = method.getName()
        const decorator = method.getDecorator('RequiresTable')

        if (!decorator) continue

        // Parse decorator arguments: @RequiresTable([{table: ..., operations: [...]}])
        const args = decorator.getArguments()
        if (args.length < 1) continue

        const permissions: TablePermission[] = []

        // Extract tables array from decorator argument
        const arrayLiteral = args[0].asKind(SyntaxKind.ArrayLiteralExpression)
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
                        operations.push(...extractOperations(opElement.getText()))
                      }
                    }
                  }
                }
              }

              if (tableName && operations.length > 0) {
                permissions.push({table: tableName, operations})
              }
            }
          }
        }

        if (permissions.length > 0) {
          const key = `${className}.${methodName}`
          entityPermissions[key] = {
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

  return entityPermissions
}

/**
 * Trace named imports through the dependency chain to find which entity methods are used.
 * Returns Set of ClassName.methodName strings that the Lambda transitively imports.
 */
function traceEntityMethodsUsed(
  lambdaPath: string,
  graph: DependencyGraph,
  functionToMethodMap: Record<string, string>
): Set<string> {
  const usedMethods = new Set<string>()
  const visited = new Set<string>()

  // Recursive function to trace named imports
  function traceFile(filePath: string) {
    if (visited.has(filePath)) return
    visited.add(filePath)

    const fileData = graph.files[filePath]
    if (!fileData) return

    for (const imp of fileData.imports) {
      const importPath = imp.path
      const namedImports = imp.namedImports

      // Check if this is the entities/queries barrel
      const normalizedPath = importPath.replace(/\.ts$/, '')
      const isBarrel =
        normalizedPath.endsWith('src/entities/queries/index') || normalizedPath === 'src/entities/queries'
      const isDirectQueryFile =
        importPath.includes('src/entities/queries/') && !importPath.endsWith('index.ts') && !isBarrel

      if (isBarrel || isDirectQueryFile) {
        // For barrel or direct query file imports, map named imports to methods
        if (namedImports) {
          for (const {name} of namedImports) {
            const methodKey = functionToMethodMap[name]
            if (methodKey) {
              usedMethods.add(methodKey)
            }
          }
        }
      } else {
        // Intermediate file - recursively trace its imports
        traceFile(importPath)
      }
    }
  }

  traceFile(lambdaPath)
  return usedMethods
}

/**
 * Trace Lambda dependencies and aggregate permissions from entity query methods
 */
function traceLambdaDependencies(
  graph: DependencyGraph,
  entityPermissions: Record<string, EntityMethodPermission>,
  functionToMethodMap: Record<string, string>
): Record<string, LambdaEntityPermissions> {
  const lambdaPermissions: Record<string, LambdaEntityPermissions> = {}

  // Find all Lambda entry points
  const lambdaEntryPoints = Object.keys(graph.transitiveDependencies || {}).filter(
    (path) => path.includes('src/lambdas/') && path.endsWith('/src/index.ts')
  )

  console.log(`\nTracing dependencies for ${lambdaEntryPoints.length} Lambdas...`)

  for (const lambdaPath of lambdaEntryPoints) {
    const lambdaName = extractLambdaName(lambdaPath)

    // Trace which entity methods are actually used
    const usedMethods = traceEntityMethodsUsed(lambdaPath, graph, functionToMethodMap)

    if (usedMethods.size === 0) continue

    // Collect permissions only for used methods
    const allPermissions: TablePermission[] = []
    const sourceFiles = new Set<string>()

    for (const methodKey of usedMethods) {
      const methodPerm = entityPermissions[methodKey]
      if (methodPerm) {
        allPermissions.push(...methodPerm.permissions)
        sourceFiles.add(methodPerm.filePath)
      }
    }

    if (allPermissions.length > 0) {
      const deduped = deduplicatePermissions(allPermissions)
      lambdaPermissions[lambdaName] = {
        tables: deduped,
        computedAccessLevel: computeAccessLevel(deduped),
        sourceFiles: Array.from(sourceFiles).sort()
      }
      console.log(`  ${lambdaName}: ${deduped.length} table(s) via ${usedMethods.size} methods`)
    }
  }

  return lambdaPermissions
}

/**
 * Deduplicate and merge permissions with same table
 */
function deduplicatePermissions(permissions: TablePermission[]): TablePermission[] {
  const merged = new Map<string, TablePermission>()

  for (const perm of permissions) {
    const key = perm.table
    const existing = merged.get(key)
    if (existing) {
      // Merge operations
      const allOps = new Set([...existing.operations, ...perm.operations])
      existing.operations = Array.from(allOps).sort()
    } else {
      merged.set(key, {...perm, operations: [...perm.operations].sort()})
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.table.localeCompare(b.table))
}

/**
 * Main extraction function
 */
async function extractPermissions(): Promise<EntityPermissionsManifest> {
  console.log('Loading TypeScript project...')

  const graph = loadDependencyGraph()

  const project = new Project({
    tsConfigFilePath: join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  })

  // Step 1: Extract entity query permissions
  console.log('\n=== Extracting Entity Query Permissions ===')
  const entityPermissions = extractEntityPermissions(project)
  console.log(`Found ${Object.keys(entityPermissions).length} decorated entity methods`)

  // Step 2: Build export maps and trace Lambda dependencies
  let lambdaPermissions: Record<string, LambdaEntityPermissions> = {}
  if (graph) {
    console.log('\n=== Building Export Maps ===')

    // Add barrel file to project
    project.addSourceFilesAtPaths(join(projectRoot, 'src/entities/queries/index.ts'))

    const barrelExportMap = buildBarrelExportMap(project, 'src/entities/queries/index.ts')
    console.log(`Barrel export map: ${Object.keys(barrelExportMap).length} exports`)

    // Get unique source files and add them to project for parsing
    const entityFilePaths = Object.values(barrelExportMap).filter((v, i, a) => a.indexOf(v) === i)
    for (const filePath of entityFilePaths) {
      project.addSourceFilesAtPaths(join(projectRoot, filePath))
    }

    const functionToMethodMap = buildFunctionToMethodMap(project, entityFilePaths)
    console.log(`Function-to-method map: ${Object.keys(functionToMethodMap).length} mappings`)

    // Step 3: Trace Lambda dependencies with method-level filtering
    console.log('\n=== Tracing Lambda Dependencies ===')
    lambdaPermissions = traceLambdaDependencies(graph, entityPermissions, functionToMethodMap)
  } else {
    console.warn('\nSkipping dependency tracing (no graph.json)')
  }

  return {
    lambdas: lambdaPermissions,
    entityMethods: entityPermissions,
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
    const outputPath = join(buildDir, 'entity-permissions.json')
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2))

    console.log(`\n=== Generated ${outputPath} ===`)
    console.log(`Found permissions for ${Object.keys(manifest.lambdas).length} Lambdas:`)

    for (const [name, perms] of Object.entries(manifest.lambdas)) {
      const tableCount = perms.tables.length
      console.log(`  - ${name}: ${perms.computedAccessLevel} (${tableCount} tables)`)
      for (const tbl of perms.tables) {
        console.log(`      ${tbl.table}: [${tbl.operations.join(', ')}]`)
      }
    }

    console.log(`\nEntity methods with permissions: ${Object.keys(manifest.entityMethods).length}`)
  } catch (error) {
    console.error('Failed to extract entity permissions:', error)
    process.exit(1)
  }
}

main()
